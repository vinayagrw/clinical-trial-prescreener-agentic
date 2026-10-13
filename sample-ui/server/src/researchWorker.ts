import { ensureResearchSchema } from "./research/db.ts";
import { getResearchConfig } from "./research/config.ts";
import {
  generateDueResearchDigests,
  recomputeResearchRelevance,
  runResearchIngest,
} from "./research/service.ts";

async function runIngestCycle(): Promise<void> {
  const ingest = await runResearchIngest();
  if (ingest.totalPublicationCount > 0) {
    await recomputeResearchRelevance();
  }
}

async function runDigestCycle(): Promise<void> {
  await generateDueResearchDigests();
}

async function bootstrapWorker(): Promise<void> {
  await ensureResearchSchema();
  const config = getResearchConfig();

  console.log("Research worker initialized.");

  if (!config.schedulerEnabled) {
    console.log("Research scheduler disabled. Exiting after schema check.");
    return;
  }

  await runIngestCycle();
  await runDigestCycle();

  setInterval(() => {
    void runIngestCycle().catch((error) => {
      console.error("Research ingest cycle failed", error);
    });
  }, config.pollIntervalMs);

  setInterval(() => {
    void runDigestCycle().catch((error) => {
      console.error("Research digest cycle failed", error);
    });
  }, config.digestCheckIntervalMs);
}

void bootstrapWorker().catch((error) => {
  console.error("Research worker failed to start", error);
  process.exitCode = 1;
});
