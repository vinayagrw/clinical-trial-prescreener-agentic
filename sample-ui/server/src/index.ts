import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { handleAiReviewApiRequest } from "./review/http.ts";
import { getCommittedHandoff } from "./review/domainCommits.ts";
import { commitAiRun } from "./review/service.ts";
import type { ReviewCommitPayload } from "./review/types.ts";
import {
  bootstrapPatientCatalog,
  handlePatientCatalogApiRequest,
} from "./patientCatalog.ts";
import { loadServerEnv } from "./env.ts";
import {
  bootstrapInstitutionalTrialCatalog,
  handleInstitutionalTrialApiRequest,
} from "./institutionalTrials.ts";
import {
  buildWorklistItem,
  generateBaselineHandoffs,
  generateHandoff,
  listDocumentsForPatient,
} from "./pipeline.ts";
import { handleResearchApiRequest } from "./research/http.ts";
import { handleNormalizationReviewApiRequest } from "./normalizationReview.ts";
import { handleScreeningApiRequest } from "./screeningOrchestrator.ts";
import { readRuntimeStore, writeRuntimeStore } from "./storage.ts";
import { handleTrialCatalogManagementApiRequest } from "./trialCatalogManagement.ts";
import { handleTrialImportApiRequest } from "./trialImports.ts";
import type { GenerateHandoffRequest, HandoffRecord, WindowHours } from "./types.ts";

loadServerEnv();

const currentDir = dirname(fileURLToPath(import.meta.url));
const runtimeFile = join(currentDir, "..", ".runtime", "handoffs.json");
const port = Number.parseInt(process.env.CLINICAL_HANDOFF_PORT ?? "4180", 10);

let handoffCache = new Map<string, HandoffRecord>();

function json(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function notFound(response: ServerResponse, message = "Not found"): void {
  json(response, 404, { error: message });
}

function serverError(response: ServerResponse, error: unknown): void {
  json(response, 500, {
    error: error instanceof Error ? error.message : "Unknown server error",
  });
}

function normalizePath(rawPath: string): string {
  if (rawPath.startsWith("/api/")) return rawPath.slice(4);
  if (rawPath === "/api") return "/";
  return rawPath;
}

function coerceWindowHours(value: string | null): WindowHours {
  if (value === "24") return 24;
  if (value === "48") return 48;
  return 72;
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function upsertRecord(record: HandoffRecord): void {
  handoffCache.set(record.id, record);
}

async function persistCache(): Promise<void> {
  await writeRuntimeStore(runtimeFile, [...handoffCache.values()]);
}

async function bootstrap(): Promise<void> {
  await bootstrapPatientCatalog();
  await bootstrapInstitutionalTrialCatalog();

  const persisted = await readRuntimeStore(runtimeFile);
  if (persisted.length > 0) {
    handoffCache = new Map(persisted.map((record) => [record.id, record]));
    return;
  }

  const baseline = generateBaselineHandoffs();
  handoffCache = new Map(baseline.map((record) => [record.id, record]));
  await persistCache();
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!request.url || !request.method) {
    notFound(response);
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    response.end();
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);
  const path = normalizePath(url.pathname);

  try {
    if (
      await handleAiReviewApiRequest({
        request,
        response,
        path,
        readBody,
      })
    ) {
      return;
    }

    if (
      await handlePatientCatalogApiRequest({
        request,
        response,
        path,
        url,
        readBody,
      })
    ) {
      return;
    }

    if (
      await handleResearchApiRequest({
        request,
        response,
        path,
        url,
        readBody,
      })
    ) {
      return;
    }

    if (
      await handleTrialImportApiRequest({
        request,
        response,
        path,
        url,
        readBody,
      })
    ) {
      return;
    }

    if (
      await handleNormalizationReviewApiRequest({
        request,
        response,
        path,
        readBody,
      })
    ) {
      return;
    }

    if (
      await handleTrialCatalogManagementApiRequest({
        request,
        response,
        path,
      })
    ) {
      return;
    }

    if (
      await handleInstitutionalTrialApiRequest({
        request,
        response,
        path,
        url,
      })
    ) {
      return;
    }

    if (
      await handleScreeningApiRequest({
        request,
        response,
        path,
        url,
        readBody,
      })
    ) {
      return;
    }

    if (request.method === "GET" && path === "/health") {
      json(response, 200, {
        ok: true,
        service: "ctp-clinical-api",
        workspace: "trial-prescreener",
        port,
        handoffCount: handoffCache.size,
      });
      return;
    }

    if (request.method === "GET" && path === "/worklist") {
      const worklist = [...handoffCache.values()]
        .filter((record) => record.windowHours === 72)
        .map(buildWorklistItem)
        .sort((left, right) => left.patientName.localeCompare(right.patientName));
      json(response, 200, { items: worklist });
      return;
    }

    if (request.method === "POST" && path === "/handoffs/generate") {
      const body = (await readBody(request)) as GenerateHandoffRequest;
      const record = generateHandoff(body);
      upsertRecord({
        ...record,
        audit: [
          ...record.audit,
          {
            id: `audit-persistence-${Date.now()}`,
            stage: "persistence",
            summary: "Persisted generated handoff record to the local runtime store.",
            detail: `Saved ${record.id} for subsequent review and audit replay.`,
            createdAt: new Date().toISOString(),
            metrics: {
              handoffId: record.id,
              windowHours: record.windowHours,
            },
          },
        ],
      });
      await persistCache();
      json(response, 200, handoffCache.get(record.id));
      return;
    }

    const finalizeHandoffMatch = path.match(/^\/handoffs\/([^/]+)\/finalize$/);
    if (request.method === "POST" && finalizeHandoffMatch) {
      const body = (await readBody(request)) as ReviewCommitPayload & { runId?: string };
      if (!body.runId) {
        json(response, 400, { error: "runId is required to finalize a handoff." });
        return;
      }
      const run = await commitAiRun(body.runId, body);
      if (!run) {
        notFound(response, "AI review run not found.");
        return;
      }
      json(response, 200, run);
      return;
    }

    const finalizedHandoffMatch = path.match(/^\/handoffs\/([^/]+)\/finalized$/);
    if (request.method === "GET" && finalizedHandoffMatch) {
      const committed = await getCommittedHandoff(finalizedHandoffMatch[1]);
      json(response, 200, committed);
      return;
    }

    const auditMatch = path.match(/^\/handoffs\/([^/]+)\/audit$/);
    if (request.method === "GET" && auditMatch) {
      const handoff = handoffCache.get(auditMatch[1]);
      if (!handoff) {
        notFound(response, "Handoff not found.");
        return;
      }
      json(response, 200, {
        handoffId: handoff.id,
        patientName: handoff.patientName,
        audit: handoff.audit,
        status: handoff.summary.status,
      });
      return;
    }

    const handoffMatch = path.match(/^\/handoffs\/([^/]+)$/);
    if (request.method === "GET" && handoffMatch) {
      const handoff = handoffCache.get(handoffMatch[1]);
      if (!handoff) {
        notFound(response, "Handoff not found.");
        return;
      }
      json(response, 200, handoff);
      return;
    }

    const patientDocsMatch = path.match(/^\/patients\/([^/]+)\/documents$/);
    if (request.method === "GET" && patientDocsMatch) {
      json(response, 200, {
        patientId: patientDocsMatch[1],
        windowHours: coerceWindowHours(url.searchParams.get("windowHours")),
        documents: listDocumentsForPatient(
          patientDocsMatch[1],
          coerceWindowHours(url.searchParams.get("windowHours")),
        ),
      });
      return;
    }

    if (request.method === "POST" && path === "/documents/reindex") {
      const baseline = generateBaselineHandoffs();
      handoffCache = new Map(baseline.map((record) => [record.id, record]));
      await persistCache();
      json(response, 200, {
        reindexed: true,
        documentCount: baseline.reduce((count, item) => count + item.documents.length, 0),
        handoffCount: baseline.length,
      });
      return;
    }

    notFound(response);
  } catch (error) {
    serverError(response, error);
  }
}

await bootstrap();

createServer((request, response) => {
  void handleRequest(request, response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Clinical handoff API listening on http://127.0.0.1:${port}`);
});
