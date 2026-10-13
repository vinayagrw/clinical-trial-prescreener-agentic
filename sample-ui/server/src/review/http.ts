import type { IncomingMessage, ServerResponse } from "node:http";
import { getTrialReviewCommit } from "./domainCommits.ts";
import {
  commitAiRun,
  commitTrialReviewDecision,
  getAiRun,
  listAiRuns,
  listPendingAiRuns,
  listReviewAudit,
  recordReviewDecision,
  requestAiRunRerun,
  upsertAiRun,
} from "./service.ts";
import type {
  AiRunUpsertInput,
  ReviewCommitPayload,
  ReviewDecisionPayload,
  ReviewRerunPayload,
  TrialReviewCommitPayload,
} from "./types.ts";

interface ReviewRequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  path: string;
  readBody: (request: IncomingMessage) => Promise<unknown>;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

export async function handleAiReviewApiRequest({
  request,
  response,
  path,
  readBody,
}: ReviewRequestContext): Promise<boolean> {
  if (!path.startsWith("/ai") && !path.startsWith("/trial-reviews")) {
    return false;
  }

  try {
    if (request.method === "GET" && path === "/ai/runs") {
      sendJson(response, 200, { items: await listAiRuns() });
      return true;
    }

    if (request.method === "GET" && path === "/ai/reviews/pending") {
      sendJson(response, 200, { items: await listPendingAiRuns() });
      return true;
    }

    if (request.method === "POST" && path === "/ai/runs") {
      const input = (await readBody(request)) as AiRunUpsertInput;
      sendJson(response, 201, await upsertAiRun(input));
      return true;
    }

    const auditMatch = path.match(/^\/ai\/runs\/([^/]+)\/audit$/);
    if (request.method === "GET" && auditMatch) {
      const run = await getAiRun(auditMatch[1]);
      if (!run) {
        sendJson(response, 404, { error: "AI review run not found." });
        return true;
      }
      sendJson(response, 200, {
        runId: run.id,
        audit: listReviewAudit(run),
      });
      return true;
    }

    const decisionMatch = path.match(/^\/ai\/runs\/([^/]+)\/checkpoints\/([^/]+)\/decision$/);
    if (request.method === "POST" && decisionMatch) {
      const input = (await readBody(request)) as ReviewDecisionPayload;
      const run = await recordReviewDecision(decisionMatch[1], {
        ...input,
        checkpointId: decisionMatch[2],
      });
      if (!run) {
        sendJson(response, 404, { error: "AI review run not found." });
        return true;
      }
      sendJson(response, 200, run);
      return true;
    }

    const rerunMatch = path.match(/^\/ai\/runs\/([^/]+)\/rerun$/);
    if (request.method === "POST" && rerunMatch) {
      const input = (await readBody(request)) as ReviewRerunPayload;
      const run = await requestAiRunRerun(rerunMatch[1], input);
      if (!run) {
        sendJson(response, 404, { error: "AI review run not found." });
        return true;
      }
      sendJson(response, 200, run);
      return true;
    }

    const commitMatch = path.match(/^\/ai\/runs\/([^/]+)\/commit$/);
    if (request.method === "POST" && commitMatch) {
      const input = (await readBody(request)) as ReviewCommitPayload;
      const run = await commitAiRun(commitMatch[1], input);
      if (!run) {
        sendJson(response, 404, { error: "AI review run not found." });
        return true;
      }
      sendJson(response, 200, run);
      return true;
    }

    const runMatch = path.match(/^\/ai\/runs\/([^/]+)$/);
    if (request.method === "GET" && runMatch) {
      const run = await getAiRun(runMatch[1]);
      if (!run) {
        sendJson(response, 404, { error: "AI review run not found." });
        return true;
      }
      sendJson(response, 200, run);
      return true;
    }

    const trialReviewMatch = path.match(/^\/trial-reviews\/([^/]+)$/);
    if (request.method === "GET" && trialReviewMatch) {
      const commit = await getTrialReviewCommit(decodeURIComponent(trialReviewMatch[1]));
      if (!commit) {
        sendJson(response, 404, { error: "Committed trial review not found." });
        return true;
      }
      sendJson(response, 200, commit);
      return true;
    }

    const trialReviewCommitMatch = path.match(/^\/trial-reviews\/([^/]+)\/commit$/);
    if (request.method === "POST" && trialReviewCommitMatch) {
      const input = (await readBody(request)) as TrialReviewCommitPayload & {
        runId: string;
        featureLabel: string;
      };
      const run = await commitTrialReviewDecision(
        decodeURIComponent(trialReviewCommitMatch[1]),
        input,
      );
      if (!run) {
        sendJson(response, 404, { error: "AI review run not found for this trial review commit." });
        return true;
      }
      sendJson(response, 200, run);
      return true;
    }
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unknown AI review API error",
      path,
    });
    return true;
  }

  return false;
}
