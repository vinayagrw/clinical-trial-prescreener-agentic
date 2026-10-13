import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ZodType } from "zod";
import { resolveDemoFixture } from "../../src/lib/ai/providers/demoFixtures/index.ts";
import {
  normalizeOpenAIStructuredOutput,
  zodSchemaToOpenAIStrictJsonSchema,
} from "../../src/lib/ai/providers/zodJsonSchema.ts";

export type ServerProviderName =
  | "ollama"
  | "openai"
  | "gemini"
  | "groq"
  | "anthropic"
  | "demo";
export type ServerRuntimeMode = "demo" | "live";

export interface ServerProviderAttempt {
  provider: ServerProviderName;
  status: "started" | "skipped" | "succeeded" | "failed";
  attemptedAt: string;
  completedAt?: string;
  model?: string;
  wallTimeMs?: number;
  reason?: string;
  errorName?: string;
  schemaPath?: string;
  schemaMessage?: string;
  schemaSummary?: string;
  schemaRawSummary?: string;
  errorCategory?:
    | "quota"
    | "network"
    | "schema"
    | "safety"
    | "fallback"
    | "configuration"
    | "unknown";
}

export interface ServerGenerateParams<T> {
  featureKey: string;
  promptVersion: string;
  system: string;
  user: string;
  runtimeMode?: ServerRuntimeMode;
  schema?: ZodType<T>;
  temperature?: number;
  maxTokens?: number;
  failoverOnSchemaError?: boolean;
  onAttempt?: (attempt: ServerProviderAttempt) => void;
}

export interface ServerGenerateResult<T> {
  value: T;
  provider: ServerProviderName;
  model: string;
  wallTimeMs: number;
  runtimeMode: ServerRuntimeMode;
  promptVersion: string;
  modelRunId: string;
}

class ProviderUnavailableError extends Error {
  readonly providerName: ServerProviderName;
  override readonly cause?: unknown;

  constructor(
    providerName: ServerProviderName,
    message: string,
    cause?: unknown,
  ) {
    super(`[${providerName}] ${message}`);
    this.name = "ProviderUnavailableError";
    this.providerName = providerName;
    this.cause = cause;
  }
}

class SchemaValidationError extends Error {
  readonly providerName: ServerProviderName;
  readonly raw: unknown;
  readonly validationError: unknown;
  readonly schemaPath?: string;
  readonly schemaMessage?: string;
  readonly schemaSummary?: string;
  readonly schemaRawSummary?: string;

  constructor(
    providerName: ServerProviderName,
    raw: unknown,
    validationError: unknown,
  ) {
    const trace = deriveSchemaValidationTrace(raw, validationError);
    super(`[${providerName}] Schema validation failed`);
    this.name = "SchemaValidationError";
    this.providerName = providerName;
    this.raw = raw;
    this.validationError = validationError;
    this.schemaPath = trace.schemaPath;
    this.schemaMessage = trace.schemaMessage;
    this.schemaSummary = trace.schemaSummary;
    this.schemaRawSummary = trace.schemaRawSummary;
  }
}

interface ServerLlmProvider {
  readonly name: ServerProviderName;
  isAvailable(): Promise<boolean>;
  generate<T>(params: ServerGenerateParams<T>): Promise<Omit<ServerGenerateResult<T>, "runtimeMode" | "promptVersion" | "modelRunId">>;
}

const DEFAULT_ORDER: ServerProviderName[] = [
  "openai",
  "gemini",
  "groq",
  "anthropic",
  "demo",
];

function env(name: string, fallback = ""): string {
  return process.env[name] ?? process.env[`VITE_${name}`] ?? fallback;
}

function readProviderOrder(): ServerProviderName[] {
  const raw =
    process.env.LLM_PROVIDER_ORDER ??
    process.env.VITE_LLM_PROVIDER_ORDER ??
    DEFAULT_ORDER.join(",");
  const parsed = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(
      (part): part is ServerProviderName =>
        ([
          "ollama",
          "openai",
          "gemini",
          "groq",
          "anthropic",
          "demo",
        ] as const).includes(part as ServerProviderName),
    );

  return parsed.length > 0 ? parsed : DEFAULT_ORDER;
}

function isDemoModeEnabled(): boolean {
  return (process.env.START_IN_DEMO_MODE ??
    process.env.VITE_START_IN_DEMO_MODE ??
    "true") === "true";
}

function makeModelRunId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
    // Fall back to String() for non-serializable values.
  }
  return String(value);
}

function summarizeValue(value: unknown, maxLength = 220): string | undefined {
  const normalized = stringifyForSummary(value).replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function readSchemaIssue(
  validationError: unknown,
): { path?: Array<string | number>; message?: string } | null {
  if (!validationError || typeof validationError !== "object") {
    return null;
  }

  const issues = (validationError as { issues?: unknown }).issues;
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
  validationError: unknown,
): {
  schemaPath?: string;
  schemaMessage?: string;
  schemaSummary?: string;
  schemaRawSummary?: string;
} {
  const rawSummary = summarizeValue(raw);
  const firstIssue = readSchemaIssue(validationError);

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
    summarizeValue(validationError, 180) ??
    "Model returned invalid JSON for the schema.";

  return {
    schemaMessage,
    schemaSummary: `invalid JSON: ${schemaMessage}`,
    schemaRawSummary: rawSummary,
  };
}

function buildStructuredOutputName(featureKey: string): string {
  const sanitized = featureKey
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "structured_output";
}

function sanitizeErrorCategory(message: string): ServerProviderAttempt["errorCategory"] {
  const lower = message.toLowerCase();
  if (lower.includes("quota") || lower.includes("429") || lower.includes("too many requests")) {
    return "quota";
  }
  if (lower.includes("schema")) {
    return "schema";
  }
  if (
    lower.includes("network") ||
    lower.includes("fetch failed") ||
    lower.includes("timeout") ||
    lower.includes("econnrefused")
  ) {
    return "network";
  }
  if (
    lower.includes("api key") ||
    lower.includes("not configured") ||
    lower.includes("missing key")
  ) {
    return "configuration";
  }
  return "unknown";
}

function readChatContent(
  content:
    | string
    | Array<{
        type?: string;
        text?: string;
      }>
    | undefined,
): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("");
}

async function readJsonErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

function parseStructuredResponse<T>(
  provider: ServerProviderName,
  content: string,
  schema?: ZodType<T>,
  normalizeForOpenAI = false,
): T {
  if (!schema) {
    return content as unknown as T;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new SchemaValidationError(provider, content, error);
  }

  const candidate = normalizeForOpenAI
    ? normalizeOpenAIStructuredOutput(schema, parsed)
    : parsed;
  const validation = schema.safeParse(candidate);
  if (!validation.success) {
    throw new SchemaValidationError(provider, candidate, validation.error);
  }

  return validation.data;
}

class DemoServerProvider implements ServerLlmProvider {
  readonly name = "demo" as const;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate<T>(
    params: ServerGenerateParams<T>,
  ): Promise<Omit<ServerGenerateResult<T>, "runtimeMode" | "promptVersion" | "modelRunId">> {
    const started = performance.now();
    const value = resolveDemoFixture<T>({
      featureKey: params.featureKey,
      system: params.system,
      user: params.user,
      schema: params.schema,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
    });

    if (value === undefined) {
      throw new ProviderUnavailableError(
        "demo",
        `No demo fixture registered for ${params.featureKey}.`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 40));

    return {
      value,
      provider: "demo",
      model: "demo-fixture",
      wallTimeMs: performance.now() - started,
    };
  }
}

class OpenAIServerProvider implements ServerLlmProvider {
  readonly name = "openai" as const;
  private readonly apiKey = env("OPENAI_API_KEY");
  private readonly model = env("OPENAI_CHAT_MODEL", "gpt-4.1-mini");

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generate<T>(
    params: ServerGenerateParams<T>,
  ): Promise<Omit<ServerGenerateResult<T>, "runtimeMode" | "promptVersion" | "modelRunId">> {
    if (!this.apiKey) {
      throw new ProviderUnavailableError("openai", "no API key configured");
    }

    const started = performance.now();
    const requestBody: Record<string, unknown> = {
      model: this.model,
      temperature: params.temperature ?? 0,
      max_completion_tokens: params.maxTokens ?? 4096,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
    };

    if (params.schema) {
      requestBody.response_format = {
        type: "json_schema",
        json_schema: {
          name: buildStructuredOutputName(params.featureKey),
          strict: true,
          schema: zodSchemaToOpenAIStrictJsonSchema(params.schema),
        },
      };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new ProviderUnavailableError("openai", await readJsonErrorMessage(response));
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const content = readChatContent(body.choices?.[0]?.message?.content);

    return {
      value: parseStructuredResponse("openai", content, params.schema, true),
      provider: "openai",
      model: this.model,
      wallTimeMs: performance.now() - started,
    };
  }
}

class GroqServerProvider implements ServerLlmProvider {
  readonly name = "groq" as const;
  private readonly apiKey = env("GROQ_API_KEY");
  private readonly model = env("GROQ_CHAT_MODEL", "llama-3.3-70b-versatile");

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async generate<T>(
    params: ServerGenerateParams<T>,
  ): Promise<Omit<ServerGenerateResult<T>, "runtimeMode" | "promptVersion" | "modelRunId">> {
    if (!this.apiKey) {
      throw new ProviderUnavailableError("groq", "no API key configured");
    }

    const started = performance.now();
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: params.temperature ?? 0,
        max_tokens: params.maxTokens ?? 4096,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
        ...(params.schema ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!response.ok) {
      throw new ProviderUnavailableError("groq", await readJsonErrorMessage(response));
    }

    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    };
    const content = readChatContent(body.choices?.[0]?.message?.content);

    return {
      value: parseStructuredResponse("groq", content, params.schema),
      provider: "groq",
      model: this.model,
      wallTimeMs: performance.now() - started,
    };
  }
}

class GeminiServerProvider implements ServerLlmProvider {
  readonly name = "gemini" as const;
  private readonly apiKey = env("GEMINI_API_KEY");
  private readonly model = env("GEMINI_CHAT_MODEL", "gemini-2.0-flash");
  private readonly client = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;

  async isAvailable(): Promise<boolean> {
    return !!this.client;
  }

  async generate<T>(
    params: ServerGenerateParams<T>,
  ): Promise<Omit<ServerGenerateResult<T>, "runtimeMode" | "promptVersion" | "modelRunId">> {
    if (!this.client) {
      throw new ProviderUnavailableError("gemini", "no API key configured");
    }

    const started = performance.now();
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: params.system,
      generationConfig: {
        temperature: params.temperature ?? 0,
        maxOutputTokens: params.maxTokens ?? 4096,
        ...(params.schema ? { responseMimeType: "application/json" } : {}),
      },
    });

    try {
      const response = await model.generateContent(params.user);
      const content = response.response.text();
      return {
        value: parseStructuredResponse("gemini", content, params.schema),
        provider: "gemini",
        model: this.model,
        wallTimeMs: performance.now() - started,
      };
    } catch (error) {
      throw new ProviderUnavailableError(
        "gemini",
        error instanceof Error ? error.message : "Unknown Gemini error",
        error,
      );
    }
  }
}

class AnthropicServerProvider implements ServerLlmProvider {
  readonly name = "anthropic" as const;
  private readonly apiKey = env("ANTHROPIC_API_KEY");
  private readonly model = env("ANTHROPIC_CHAT_MODEL", "claude-sonnet-4-5-20250929");
  private readonly client = this.apiKey ? new Anthropic({ apiKey: this.apiKey }) : null;

  async isAvailable(): Promise<boolean> {
    return !!this.client;
  }

  async generate<T>(
    params: ServerGenerateParams<T>,
  ): Promise<Omit<ServerGenerateResult<T>, "runtimeMode" | "promptVersion" | "modelRunId">> {
    if (!this.client) {
      throw new ProviderUnavailableError("anthropic", "no API key configured");
    }

    const started = performance.now();

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
      });
      const content = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        value: parseStructuredResponse("anthropic", content, params.schema),
        provider: "anthropic",
        model: this.model,
        wallTimeMs: performance.now() - started,
      };
    } catch (error) {
      throw new ProviderUnavailableError(
        "anthropic",
        error instanceof Error ? error.message : "Unknown Anthropic error",
        error,
      );
    }
  }
}

export class ServerLlmGateway {
  private readonly providers = new Map<ServerProviderName, ServerLlmProvider>();
  private readonly order = readProviderOrder();
  private readonly demoMode = isDemoModeEnabled();

  constructor() {
    this.providers.set("openai", new OpenAIServerProvider());
    this.providers.set("gemini", new GeminiServerProvider());
    this.providers.set("groq", new GroqServerProvider());
    this.providers.set("anthropic", new AnthropicServerProvider());
    this.providers.set("demo", new DemoServerProvider());
  }

  getOrder(runtimeModeOverride?: ServerRuntimeMode): ServerProviderName[] {
    const runtimeMode = runtimeModeOverride ?? this.getRuntimeMode();
    return runtimeMode === "demo" ? ["demo"] : [...this.order];
  }

  getRuntimeMode(runtimeModeOverride?: ServerRuntimeMode): ServerRuntimeMode {
    return runtimeModeOverride ?? (this.demoMode ? "demo" : "live");
  }

  async generate<T>(params: ServerGenerateParams<T>): Promise<ServerGenerateResult<T>> {
    const runtimeMode = this.getRuntimeMode(params.runtimeMode);
    const activeOrder = this.getOrder(runtimeMode);
    const errors: string[] = [];

    for (const providerName of activeOrder) {
      const provider = this.providers.get(providerName);
      if (!provider) {
        continue;
      }

      const attemptedAt = new Date().toISOString();
      const available = await provider.isAvailable();
      if (!available) {
        params.onAttempt?.({
          provider: providerName,
          status: "skipped",
          attemptedAt,
          completedAt: new Date().toISOString(),
          reason: "Provider not configured.",
          errorCategory: "configuration",
        });
        errors.push(`${providerName}: not configured`);
        continue;
      }

      params.onAttempt?.({
        provider: providerName,
        status: "started",
        attemptedAt,
      });

      try {
        const result = await provider.generate(params);
        params.onAttempt?.({
          provider: providerName,
          status: "succeeded",
          attemptedAt,
          completedAt: new Date().toISOString(),
          model: result.model,
          wallTimeMs: result.wallTimeMs,
        });
        return {
          ...result,
          runtimeMode,
          promptVersion: params.promptVersion,
          modelRunId: makeModelRunId(providerName),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown provider failure";
        params.onAttempt?.({
          provider: providerName,
          status: "failed",
          attemptedAt,
          completedAt: new Date().toISOString(),
          model: undefined,
          wallTimeMs: undefined,
          reason: message,
          errorName: error instanceof Error ? error.name : "UnknownError",
          ...(error instanceof SchemaValidationError
            ? {
                schemaPath: error.schemaPath,
                schemaMessage: error.schemaMessage,
                schemaSummary: error.schemaSummary,
                schemaRawSummary: error.schemaRawSummary,
              }
            : {}),
          errorCategory:
            error instanceof SchemaValidationError
              ? "schema"
              : sanitizeErrorCategory(message),
        });

        if (error instanceof SchemaValidationError) {
          errors.push(message);
          if (!params.failoverOnSchemaError) {
            throw error;
          }
          continue;
        }

        errors.push(message);
      }
    }

    throw new ProviderUnavailableError(
      "demo",
      `All providers failed: ${errors.join(" | ")}`,
    );
  }
}

let gatewaySingleton: ServerLlmGateway | null = null;

export function getServerLlmGateway(): ServerLlmGateway {
  if (!gatewaySingleton) {
    gatewaySingleton = new ServerLlmGateway();
  }
  return gatewaySingleton;
}
