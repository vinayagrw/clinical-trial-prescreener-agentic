import type { IncomingMessage, ServerResponse } from "node:http";
import { getResearchDigestCommit } from "../review/domainCommits.ts";
import { archiveResearchDigestRun, commitAiRun } from "../review/service.ts";
import { getPublicationDetail } from "./db.ts";
import {
  createInstitutionalProjectRecord,
  createResearchProfileRecord,
  generateResearchDigests,
  getResearchDigestRecord,
  getResearchProfileRecord,
  listResearchProfilesWithSummary,
  recomputeResearchRelevance,
  runResearchIngest,
  updateResearchProfileRecord,
} from "./service.ts";
import type {
  CreateInstitutionalProjectInput,
  CreateResearchProfileInput,
  GenerateDigestInput,
  UpdateResearchProfileInput,
} from "./types.ts";
import type { ReviewCommitPayload } from "../review/types.ts";

interface ResearchRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  path: string;
  url: URL;
  readBody: (request: IncomingMessage) => Promise<unknown>;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseProfileInput(payload: unknown): CreateResearchProfileInput {
  const body = (payload ?? {}) as Record<string, unknown>;
  return {
    ownerType: String(body.ownerType ?? "faculty") as CreateResearchProfileInput["ownerType"],
    ownerName: String(body.ownerName ?? "").trim(),
    labName: String(body.labName ?? "").trim(),
    keywords: parseStringArray(body.keywords),
    excludedTerms: parseStringArray(body.excludedTerms),
    methodInterests: parseStringArray(body.methodInterests),
    domainInterests: parseStringArray(body.domainInterests),
    digestDayOfWeek: body.digestDayOfWeek ? String(body.digestDayOfWeek) : undefined,
    digestTimeLocal: body.digestTimeLocal ? String(body.digestTimeLocal) : undefined,
    timezone: body.timezone ? String(body.timezone) : undefined,
    sources: Array.isArray(body.sources)
      ? body.sources.map((item) => String(item)) as CreateResearchProfileInput["sources"]
      : undefined,
  };
}

function parseProfilePatch(payload: unknown): UpdateResearchProfileInput {
  const body = (payload ?? {}) as Record<string, unknown>;
  const patch: UpdateResearchProfileInput = {};

  if (body.ownerType != null) patch.ownerType = String(body.ownerType) as UpdateResearchProfileInput["ownerType"];
  if (body.ownerName != null) patch.ownerName = String(body.ownerName).trim();
  if (body.labName != null) patch.labName = String(body.labName).trim();
  if (body.keywords != null) patch.keywords = parseStringArray(body.keywords);
  if (body.excludedTerms != null) patch.excludedTerms = parseStringArray(body.excludedTerms);
  if (body.methodInterests != null) patch.methodInterests = parseStringArray(body.methodInterests);
  if (body.domainInterests != null) patch.domainInterests = parseStringArray(body.domainInterests);
  if (body.digestDayOfWeek != null) patch.digestDayOfWeek = String(body.digestDayOfWeek);
  if (body.digestTimeLocal != null) patch.digestTimeLocal = String(body.digestTimeLocal);
  if (body.timezone != null) patch.timezone = String(body.timezone);
  if (body.sources != null && Array.isArray(body.sources)) {
    patch.sources = body.sources.map((item) => String(item)) as UpdateResearchProfileInput["sources"];
  }

  return patch;
}

function parseProjectInput(payload: unknown): CreateInstitutionalProjectInput {
  const body = (payload ?? {}) as Record<string, unknown>;
  return {
    name: String(body.name ?? "").trim(),
    summary: String(body.summary ?? "").trim(),
    methods: parseStringArray(body.methods),
    modalities: parseStringArray(body.modalities),
    seedPapers: parseStringArray(body.seedPapers),
    aliases: parseStringArray(body.aliases),
  };
}

function assertProfileFields(input: CreateResearchProfileInput): void {
  if (!input.ownerName || !input.labName) {
    throw new Error("ownerName and labName are required.");
  }
}

function assertProjectFields(input: CreateInstitutionalProjectInput): void {
  if (!input.name || !input.summary) {
    throw new Error("name and summary are required.");
  }
}

export async function handleResearchApiRequest({
  request,
  response,
  path,
  url,
  readBody,
}: ResearchRequestContext): Promise<boolean> {
  if (!path.startsWith("/research")) {
    return false;
  }

  try {
    if (request.method === "GET" && path === "/research/profiles") {
      const items = await listResearchProfilesWithSummary();
      sendJson(response, 200, { items });
      return true;
    }

    if (request.method === "POST" && path === "/research/profiles") {
      const input = parseProfileInput(await readBody(request));
      assertProfileFields(input);
      const profile = await createResearchProfileRecord(input);
      sendJson(response, 201, profile);
      return true;
    }

    const digestsForProfileMatch = path.match(/^\/research\/profiles\/([^/]+)\/digests$/);
    if (request.method === "GET" && digestsForProfileMatch) {
      const detail = await getResearchProfileRecord(digestsForProfileMatch[1]);
      if (!detail) {
        sendJson(response, 404, { error: "Research profile not found." });
        return true;
      }

      sendJson(response, 200, {
        profile: detail.profile,
        items: detail.recentDigests,
      });
      return true;
    }

    const addProjectMatch = path.match(/^\/research\/profiles\/([^/]+)\/projects$/);
    if (request.method === "POST" && addProjectMatch) {
      const input = parseProjectInput(await readBody(request));
      assertProjectFields(input);
      const project = await createInstitutionalProjectRecord(addProjectMatch[1], input);
      sendJson(response, 201, project);
      return true;
    }

    const profileMatch = path.match(/^\/research\/profiles\/([^/]+)$/);
    if (profileMatch) {
      if (request.method === "GET") {
        const detail = await getResearchProfileRecord(profileMatch[1]);
        if (!detail) {
          sendJson(response, 404, { error: "Research profile not found." });
          return true;
        }

        sendJson(response, 200, detail);
        return true;
      }

      if (request.method === "PATCH") {
        const patch = parseProfilePatch(await readBody(request));
        const profile = await updateResearchProfileRecord(profileMatch[1], patch);
        if (!profile) {
          sendJson(response, 404, { error: "Research profile not found." });
          return true;
        }

        sendJson(response, 200, profile);
        return true;
      }
    }

    if (request.method === "POST" && path === "/research/ingest/run") {
      const body = (await readBody(request)) as { profileId?: string };
      const result = await runResearchIngest(body?.profileId);
      sendJson(response, 200, result);
      return true;
    }

    if (request.method === "POST" && path === "/research/relevance/recompute") {
      const body = (await readBody(request)) as { profileId?: string };
      const result = await recomputeResearchRelevance(body?.profileId);
      sendJson(response, 200, result);
      return true;
    }

    if (request.method === "POST" && path === "/research/digests/generate") {
      const body = ((await readBody(request)) ?? {}) as GenerateDigestInput;
      const result = await generateResearchDigests(body);
      sendJson(response, 200, result);
      return true;
    }

    const digestMatch = path.match(/^\/research\/digests\/([^/]+)$/);
    if (request.method === "GET" && digestMatch) {
      const detail = await getResearchDigestRecord(digestMatch[1]);
      if (!detail) {
        sendJson(response, 404, { error: "Digest not found." });
        return true;
      }

      sendJson(response, 200, detail);
      return true;
    }

    const digestPublicationMatch = path.match(/^\/research\/digests\/([^/]+)\/publication$/);
    if (request.method === "GET" && digestPublicationMatch) {
      const committed = await getResearchDigestCommit(digestPublicationMatch[1]);
      sendJson(response, 200, committed);
      return true;
    }

    const publishDigestMatch = path.match(/^\/research\/digests\/([^/]+)\/publish$/);
    if (request.method === "POST" && publishDigestMatch) {
      const input = (await readBody(request)) as ReviewCommitPayload & { runId?: string };
      if (!input.runId) {
        sendJson(response, 400, { error: "runId is required to publish a reviewed digest." });
        return true;
      }
      const run = await commitAiRun(input.runId, input);
      if (!run) {
        sendJson(response, 404, { error: "AI review run not found." });
        return true;
      }
      sendJson(response, 200, run);
      return true;
    }

    const archiveDigestMatch = path.match(/^\/research\/digests\/([^/]+)\/archive$/);
    if (request.method === "POST" && archiveDigestMatch) {
      const input = (await readBody(request)) as ReviewCommitPayload & { runId?: string };
      if (!input.runId) {
        sendJson(response, 400, { error: "runId is required to archive a reviewed digest." });
        return true;
      }
      const run = await archiveResearchDigestRun(input.runId, input);
      if (!run) {
        sendJson(response, 404, { error: "AI review run not found." });
        return true;
      }
      sendJson(response, 200, run);
      return true;
    }

    const publicationMatch = path.match(/^\/research\/publications\/([^/]+)$/);
    if (request.method === "GET" && publicationMatch) {
      const detail = await getPublicationDetail(publicationMatch[1]);
      if (!detail) {
        sendJson(response, 404, { error: "Publication not found." });
        return true;
      }

      sendJson(response, 200, detail);
      return true;
    }
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unknown research API error",
      path,
      query: Object.fromEntries(url.searchParams.entries()),
    });
    return true;
  }

  return false;
}
