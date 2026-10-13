import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";

let envLoaded = false;

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadEnvFiles(): void {
  if (envLoaded) {
    return;
  }

  const projectRoot = cwd();
  const candidates = [
    join(projectRoot, ".env.local"),
    join(projectRoot, ".env"),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;

    const content = readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separator = line.indexOf("=");
      if (separator === -1) continue;

      const key = line.slice(0, separator).trim();
      const value = stripQuotes(line.slice(separator + 1).trim());
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }

  envLoaded = true;
}

function readString(name: string, fallback = ""): string {
  loadEnvFiles();
  return process.env[name] ?? fallback;
}

function readNumber(name: string, fallback: number): number {
  const value = Number.parseInt(readString(name, `${fallback}`), 10);
  return Number.isFinite(value) ? value : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = readString(name, fallback ? "true" : "false").toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

export interface ResearchRuntimeConfig {
  databaseUrl: string;
  vectorDimensions: number;
  ncbiEmail: string;
  ncbiApiKey: string;
  ingestLookbackDays: number;
  pubmedRetmax: number;
  preprintPageSize: number;
  schedulerEnabled: boolean;
  pollIntervalMs: number;
  digestCheckIntervalMs: number;
  geminiApiKey: string;
  geminiModel: string;
}

let configSingleton: ResearchRuntimeConfig | null = null;

export function getResearchConfig(): ResearchRuntimeConfig {
  if (configSingleton) {
    return configSingleton;
  }

  configSingleton = {
    databaseUrl: readString("RESEARCH_DATABASE_URL"),
    vectorDimensions: readNumber("RESEARCH_VECTOR_DIMENSIONS", 64),
    ncbiEmail: readString("RESEARCH_NCBI_EMAIL"),
    ncbiApiKey: readString("RESEARCH_NCBI_API_KEY"),
    ingestLookbackDays: readNumber("RESEARCH_INGEST_LOOKBACK_DAYS", 7),
    pubmedRetmax: readNumber("RESEARCH_PUBMED_RETMAX", 80),
    preprintPageSize: readNumber("RESEARCH_PREPRINT_PAGE_SIZE", 75),
    schedulerEnabled: readBoolean("RESEARCH_SCHEDULER_ENABLED", true),
    pollIntervalMs: readNumber("RESEARCH_POLL_INTERVAL_MS", 60 * 60 * 1000),
    digestCheckIntervalMs: readNumber("RESEARCH_DIGEST_CHECK_INTERVAL_MS", 15 * 60 * 1000),
    geminiApiKey:
      readString("RESEARCH_GEMINI_API_KEY") || readString("VITE_GEMINI_API_KEY"),
    geminiModel: readString("RESEARCH_GEMINI_MODEL") || readString("VITE_GEMINI_CHAT_MODEL", "gemini-2.0-flash"),
  };

  return configSingleton;
}

export function assertResearchDatabaseConfigured(): string {
  const { databaseUrl } = getResearchConfig();
  if (!databaseUrl) {
    throw new Error(
      "RESEARCH_DATABASE_URL is not configured. Add it to .env.local before using /api/research.",
    );
  }

  return databaseUrl;
}
