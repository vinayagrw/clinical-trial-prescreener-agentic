/*
 * Shared LLM provider types — interface + request/response shapes.
 *
 * Every concrete provider (ollama, openai, gemini, groq, anthropic, demo)
 * implements LLMProvider. The orchestrator picks providers in the order
 * declared by VITE_LLM_PROVIDER_ORDER and fails over when one is
 * unhealthy or raises ProviderUnavailableError.
 */

import type { ZodType } from "zod";

export type ProviderName =
  | "ollama"
  | "openai"
  | "gemini"
  | "groq"
  | "anthropic"
  | "demo";

export type ProviderStatus = "unknown" | "healthy" | "unhealthy" | "disabled";
export type ProviderAttemptStatus = "started" | "skipped" | "succeeded" | "failed";

export interface SchemaValidationTrace {
  schemaPath?: string;
  schemaMessage?: string;
  schemaSummary?: string;
  schemaRawSummary?: string;
}

export interface ProviderAttemptTrace extends SchemaValidationTrace {
  provider: ProviderName;
  status: ProviderAttemptStatus;
  model?: string;
  reason?: string;
  errorName?: string;
  wallTimeMs?: number;
}

export interface GenerateParams<T = string> {
  system: string;
  user: string;
  /** If present, forces structured-output mode and validates with Zod. */
  schema?: ZodType<T>;
  /** Feature identifier for logging + fixture lookup. e.g. "F1_decompose". */
  featureKey: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Schema mismatches are terminal by default because they usually indicate
   * prompt/contract drift rather than provider health issues.
   */
  failoverOnSchemaError?: boolean;
  signal?: AbortSignal;
  onAttempt?: (attempt: ProviderAttemptTrace) => void;
}

export interface GenerateResult<T> {
  /** Parsed structured output if schema was provided, else raw string cast to T. */
  value: T;
  /** Provider that actually handled the request after failover. */
  provider: ProviderName;
  /** Model identifier reported by the provider. */
  model: string;
  wallTimeMs: number;
}

export interface StreamParams {
  system: string;
  user: string;
  featureKey: string;
  temperature?: number;
  signal?: AbortSignal;
}

export interface StreamEvent {
  token: string;
  provider: ProviderName;
  model: string;
  done: boolean;
}

export interface EmbedResult {
  embeddings: number[][];
  provider: ProviderName;
  model: string;
  wallTimeMs: number;
}

export interface LLMProvider {
  readonly name: ProviderName;
  readonly supportsStreaming: boolean;
  readonly supportsEmbeddings: boolean;
  isAvailable(): Promise<boolean>;
  generate<T = string>(params: GenerateParams<T>): Promise<GenerateResult<T>>;
  stream(params: StreamParams): AsyncIterable<StreamEvent>;
  embed(texts: string[]): Promise<EmbedResult>;
}

function formatSchemaPath(path: Array<string | number> | undefined): string | undefined {
  if (!Array.isArray(path) || path.length === 0) {
    return undefined;
  }

  return path.reduce<string>((acc, segment) => {
    if (typeof segment === "number") {
      return `${acc}[${segment}]`;
    }
    return acc ? `${acc}.${segment}` : segment;
  }, "");
}

function stringifyForSummary(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Error) {
    return value.message;
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized) {
      return serialized;
    }
  } catch {
    // Fall back to String() below for non-serializable values.
  }
  return String(value);
}

function summarizeValue(value: unknown, maxLength = 220): string | undefined {
  const normalized = stringifyForSummary(value).replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function readSchemaIssue(
  zodError: unknown,
): { path?: Array<string | number>; message?: string } | null {
  if (!zodError || typeof zodError !== "object") {
    return null;
  }

  const issues = (zodError as { issues?: unknown }).issues;
  if (!Array.isArray(issues) || issues.length === 0) {
    return null;
  }

  const firstIssue = issues[0] as {
    path?: Array<string | number>;
    message?: string;
  };

  return {
    path: Array.isArray(firstIssue.path) ? firstIssue.path : undefined,
    message:
      typeof firstIssue.message === "string" ? firstIssue.message.trim() : undefined,
  };
}

function deriveSchemaValidationTrace(
  raw: unknown,
  zodError: unknown,
): SchemaValidationTrace {
  const rawSummary = summarizeValue(raw);
  const firstIssue = readSchemaIssue(zodError);

  if (firstIssue) {
    const schemaPath = formatSchemaPath(firstIssue.path);
    const schemaMessage = firstIssue.message ?? "Schema mismatch";
    return {
      schemaPath,
      schemaMessage,
      schemaSummary: schemaPath ? `${schemaPath}: ${schemaMessage}` : schemaMessage,
      schemaRawSummary: rawSummary,
    };
  }

  const schemaMessage =
    summarizeValue(zodError, 180) ?? "Model returned invalid JSON for the schema.";

  return {
    schemaMessage,
    schemaSummary: `invalid JSON: ${schemaMessage}`,
    schemaRawSummary: rawSummary,
  };
}

/** Raised when a provider cannot handle a request — orchestrator catches this and fails over. */
export class ProviderUnavailableError extends Error {
  constructor(
    public providerName: ProviderName,
    message: string,
    public cause?: unknown,
  ) {
    super(`[${providerName}] ${message}`);
    this.name = "ProviderUnavailableError";
  }
}

/** Raised when a provider returned a response but it failed schema validation. */
export class SchemaValidationError extends Error implements SchemaValidationTrace {
  public schemaPath?: string;
  public schemaMessage?: string;
  public schemaSummary?: string;
  public schemaRawSummary?: string;

  constructor(
    public providerName: ProviderName,
    public raw: unknown,
    public zodError: unknown,
  ) {
    const trace = deriveSchemaValidationTrace(raw, zodError);
    super(
      `[${providerName}] Schema validation failed${
        trace.schemaSummary ? `: ${trace.schemaSummary}` : ""
      }`,
    );
    this.name = "SchemaValidationError";
    this.schemaPath = trace.schemaPath;
    this.schemaMessage = trace.schemaMessage;
    this.schemaSummary = trace.schemaSummary;
    this.schemaRawSummary = trace.schemaRawSummary;
  }
}
