import { spawn } from "node:child_process";
import readline from "node:readline";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiBase = process.env.CLINICAL_API_BASE ?? "http://127.0.0.1:4180";
const healthUrl = new URL("/health", apiBase).toString();
const apiServiceName = "ctp-clinical-api";
const apiWorkspaceName = "trial-prescreener";
const defaultClientPort = Number.parseInt(process.env.PORT || "4174", 10);
const clientProbeHosts = ["localhost", "127.0.0.1"];
const clientProbePorts = Array.from({ length: 5 }, (_, index) => defaultClientPort + index);
const defaultClientBase = `http://localhost:${defaultClientPort}`;
let discoveredClientBase = defaultClientBase;
const clientTitleMarker = "CTP Trial Eligibility Pre-Screener";
const serverStartupTimeoutMs = 20_000;
const serverPollIntervalMs = 500;
const childExitGracePeriodMs = 2_000;

const children = [];
let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeClientBase(base) {
  return base.replace(/\/$/, "");
}

function buildClientBase(host, port) {
  return `http://${host}:${port}`;
}

function clientProbeLabel() {
  return `${buildClientBase(clientProbeHosts[0], clientProbePorts[0])}-${clientProbePorts.at(-1)}`;
}

function clientCandidateBases() {
  const candidates = [];
  const seen = new Set();

  const pushCandidate = (base) => {
    const normalized = normalizeClientBase(base);
    if (seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    candidates.push(normalized);
  };

  pushCandidate(discoveredClientBase);
  for (const port of clientProbePorts) {
    for (const host of clientProbeHosts) {
      pushCandidate(buildClientBase(host, port));
    }
  }

  return candidates;
}

function isExpectedConnectionMiss(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("fetch failed") ||
    message.includes("econnrefused") ||
    message.includes("timeout") ||
    message.includes("bad port") ||
    message.includes("networkerror")
  );
}

function isExpectedClientHtml(html) {
  const hasRoot = html.includes('<div id="root"></div>') || html.includes('<div id="root">');
  const hasDevEntry =
    html.includes("/src/main.tsx") || html.includes("/@vite/client") || html.includes("@vite/client");
  const hasTitle = html.includes(clientTitleMarker);

  return hasRoot && hasDevEntry && hasTitle;
}

function maybeCaptureClientBase(line) {
  const match = line.match(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+\//i);
  if (!match) {
    return;
  }

  discoveredClientBase = normalizeClientBase(match[0]);
}

function prefixStream(name, stream, write, onLine) {
  if (!stream) {
    return;
  }

  const reader = readline.createInterface({ input: stream });
  reader.on("line", (line) => {
    onLine?.(line);
    write(`[${name}] ${line}\n`);
  });
}

function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return Promise.resolve();
  }

  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => {
        try {
          child.kill("SIGTERM");
        } catch {
          // Ignore cleanup failures on shutdown.
        }
        resolve();
      });
    });
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Ignore cleanup failures on shutdown.
  }

  return Promise.resolve();
}

async function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  await Promise.all(children.map((child) => stopChild(child)));
  process.exit(code);
}

function spawnScript(name, args) {
  process.stdout.write(`[launcher] Starting ${name}...\n`);

  const child =
    process.platform === "win32"
      ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm.cmd ${args.join(" ")}`], {
          cwd: projectRoot,
          env: process.env,
          stdio: ["inherit", "pipe", "pipe"],
        })
      : spawn("npm", args, {
          cwd: projectRoot,
          env: process.env,
          stdio: ["inherit", "pipe", "pipe"],
        });

  const lineHandler = name === "client" ? maybeCaptureClientBase : undefined;
  prefixStream(
    name,
    child.stdout,
    process.stdout.write.bind(process.stdout),
    lineHandler,
  );
  prefixStream(
    name,
    child.stderr,
    process.stderr.write.bind(process.stderr),
    lineHandler,
  );

  child.on("error", (error) => {
    process.stderr.write(`[launcher] Failed to start ${name}: ${error.message}\n`);
    void shutdown(1);
  });

  children.push(child);
  return child;
}

function attachClientExitHandler(child) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    process.stderr.write(
      `[launcher] client exited with ${reason}. Stopping local dev.\n`,
    );
    void shutdown(code ?? 1);
  });
}

function attachServerExitHandler(child) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    process.stderr.write(
      `[launcher] server exited with ${reason}. Stopping local dev.\n`,
    );
    void shutdown(code ?? 1);
  });
}

async function probeHealth() {
  try {
    const response = await fetch(healthUrl, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        kind: "occupied",
        detail: `Port 4180 responded with status ${response.status}, but it did not expose the expected healthy API response.`,
      };
    }

    const payload = await response.json();
    if (
      payload &&
      payload.service === apiServiceName &&
      payload.workspace === apiWorkspaceName
    ) {
      return {
        kind: "ready",
        detail: `Reusing existing API on ${apiBase}.`,
      };
    }

    return {
      kind: "occupied",
      detail:
        "Port 4180 is already serving a different process. Stop that process or change the local API port before running npm run dev.",
    };
  } catch (error) {
    if (isExpectedConnectionMiss(error)) {
      return {
        kind: "missing",
        detail: `No API is listening on ${apiBase} yet.`,
      };
    }

    return {
      kind: "occupied",
      detail:
        error instanceof Error
          ? `Unable to verify the API on ${apiBase}: ${error.message}`
          : `Unable to verify the API on ${apiBase}.`,
    };
  }
}

async function probeClientBase(base) {
  const normalizedBase = normalizeClientBase(base);

  try {
    const response = await fetch(new URL("/", `${normalizedBase}/`).toString(), {
      headers: { Accept: "text/html" },
    });

    if (!response.ok) {
      return {
        kind: "occupied",
        base: normalizedBase,
        detail: `${normalizedBase} responded with status ${response.status}, but it did not expose the expected Vite client.`,
      };
    }

    const html = await response.text();
    if (isExpectedClientHtml(html)) {
      return {
        kind: "ready",
        base: normalizedBase,
        detail: `Reusing existing client on ${normalizedBase}.`,
      };
    }

    return {
      kind: "occupied",
      base: normalizedBase,
      detail: `${normalizedBase} is serving a different process.`,
    };
  } catch (error) {
    if (isExpectedConnectionMiss(error)) {
      return {
        kind: "missing",
        base: normalizedBase,
        detail: `No client is listening on ${normalizedBase} yet.`,
      };
    }

    return {
      kind: "occupied",
      base: normalizedBase,
      detail:
        error instanceof Error
          ? `Unable to verify the Vite client on ${normalizedBase}: ${error.message}`
          : `Unable to verify the Vite client on ${normalizedBase}.`,
    };
  }
}

async function probeClient() {
  for (const candidate of clientCandidateBases()) {
    const result = await probeClientBase(candidate);
    if (result.kind === "ready") {
      discoveredClientBase = result.base;
      return result;
    }
  }

  return {
    kind: "missing",
    detail: `No matching Vite client is listening on ${clientProbeLabel()} yet.`,
  };
}

async function waitForHealthyApi(serverChild) {
  const deadline = Date.now() + serverStartupTimeoutMs;

  while (Date.now() < deadline) {
    if (serverChild.exitCode !== null) {
      throw new Error("The local API process exited before it became healthy.");
    }

    const health = await probeHealth();
    if (health.kind === "ready") {
      process.stdout.write(`[launcher] API ready on ${apiBase}.\n`);
      return;
    }

    if (health.kind === "occupied") {
      throw new Error(health.detail);
    }

    await sleep(serverPollIntervalMs);
  }

  throw new Error(
    `Timed out waiting for the local API on ${apiBase}. Check the server logs above for startup errors.`,
  );
}

async function waitForClientReady(clientChild) {
  const deadline = Date.now() + serverStartupTimeoutMs;

  while (Date.now() < deadline) {
    if (clientChild.exitCode !== null) {
      throw new Error("The Vite client process exited before it became ready.");
    }

    const client = await probeClient();
    if (client.kind === "ready") {
      process.stdout.write(`[launcher] Client ready on ${discoveredClientBase}.\n`);
      return;
    }

    if (client.kind === "occupied") {
      throw new Error(client.detail);
    }

    await sleep(serverPollIntervalMs);
  }

  throw new Error(
    `Timed out waiting for the Vite client on ${discoveredClientBase}. Checked ${clientProbeLabel()}. Check the client logs above for startup errors.`,
  );
}

async function ensureApiReady() {
  const initialHealth = await probeHealth();

  if (initialHealth.kind === "ready") {
    process.stdout.write(`[launcher] ${initialHealth.detail}\n`);
    return null;
  }

  if (initialHealth.kind === "occupied") {
    throw new Error(initialHealth.detail);
  }

  process.stdout.write(`[launcher] ${initialHealth.detail}\n`);
  const serverChild = spawnScript("server", ["run", "dev:server"]);

  const earlyExitPromise = new Promise((resolve) => {
    serverChild.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });

  const winner = await Promise.race([
    waitForHealthyApi(serverChild).then(() => ({ kind: "healthy" })),
    earlyExitPromise.then((result) => ({ kind: "exit", result })),
    sleep(childExitGracePeriodMs).then(() => ({ kind: "grace" })),
  ]);

  if (winner.kind === "exit") {
    const { code, signal } = winner.result;
    throw new Error(
      `The local API process exited before startup completed (${signal ? `signal ${signal}` : `code ${code ?? 0}`}).`,
    );
  }

  if (winner.kind === "healthy") {
    return serverChild;
  }

  await waitForHealthyApi(serverChild);
  return serverChild;
}

async function ensureClientReady() {
  discoveredClientBase = defaultClientBase;
  const initialClient = await probeClient();

  if (initialClient.kind === "ready") {
    process.stdout.write(`[launcher] ${initialClient.detail}\n`);
    return null;
  }

  process.stdout.write(`[launcher] ${initialClient.detail}\n`);
  const clientChild = spawnScript("client", ["run", "dev:client"]);

  const earlyExitPromise = new Promise((resolve) => {
    clientChild.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });

  const winner = await Promise.race([
    waitForClientReady(clientChild).then(() => ({ kind: "ready" })),
    earlyExitPromise.then((result) => ({ kind: "exit", result })),
    sleep(childExitGracePeriodMs).then(() => ({ kind: "grace" })),
  ]);

  if (winner.kind === "exit") {
    const { code, signal } = winner.result;
    throw new Error(
      `The Vite client process exited before startup completed (${signal ? `signal ${signal}` : `code ${code ?? 0}`}).`,
    );
  }

  if (winner.kind === "ready") {
    return clientChild;
  }

  await waitForClientReady(clientChild);
  return clientChild;
}

async function main() {
  try {
    const serverChild = await ensureApiReady();
    if (serverChild) {
      attachServerExitHandler(serverChild);
    }
    const clientChild = await ensureClientReady();
    if (clientChild) {
      attachClientExitHandler(clientChild);
    }
  } catch (error) {
    process.stderr.write(
      `[launcher] ${error instanceof Error ? error.message : "Failed to start local dev."}\n`,
    );
    await shutdown(1);
  }
}

process.on("SIGINT", () => {
  process.stdout.write("\n[launcher] Stopping client and server...\n");
  void shutdown(0);
});

process.on("SIGTERM", () => {
  process.stdout.write("\n[launcher] Stopping client and server...\n");
  void shutdown(0);
});

void main();
