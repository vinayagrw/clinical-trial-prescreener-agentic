/*
 * LlmOrchestrator — failover chain across LLM providers.
 *
 * Reads VITE_LLM_PROVIDER_ORDER to determine the failover sequence, keeps
 * a live health map (healthy / unhealthy / unknown / disabled) per provider,
 * and routes generate / stream / embed calls down the chain until one
 * succeeds.
 *
 * When demo mode is on, the chain collapses to just the demo provider so
 * the app is guaranteed to run offline with no external calls.
 */

import type {
  EmbedResult,
  GenerateParams,
  GenerateResult,
  LLMProvider,
  ProviderName,
  ProviderStatus,
  StreamEvent,
  StreamParams,
} from "./types";
import { ProviderUnavailableError, SchemaValidationError } from "./types";
import { AnthropicProvider } from "./anthropicProvider";
import { DemoProvider } from "./demoProvider";
import { GeminiProvider } from "./geminiProvider";
import { GroqProvider } from "./groqProvider";
import { OllamaProvider } from "./ollamaProvider";
import { OpenAIProvider } from "./openaiProvider";

export type ProviderHealthMap = Record<ProviderName, ProviderStatus>;

const DEFAULT_ORDER: ProviderName[] = [
  "ollama",
  "openai",
  "gemini",
  "groq",
  "anthropic",
  "demo",
];

function readOrder(): ProviderName[] {
  const raw = import.meta.env.VITE_LLM_PROVIDER_ORDER;
  if (!raw) return DEFAULT_ORDER;
  const parts = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderName =>
      (["ollama", "openai", "gemini", "groq", "anthropic", "demo"] as const).includes(
        s as ProviderName,
      ),
    );
  return parts.length ? parts : DEFAULT_ORDER;
}

export class LlmOrchestrator {
  private providers: Map<ProviderName, LLMProvider>;
  private order: ProviderName[];
  private health: ProviderHealthMap;
  private healthListeners = new Set<(h: ProviderHealthMap) => void>();
  private demoMode: boolean;

  constructor() {
    this.providers = new Map<ProviderName, LLMProvider>();
    this.providers.set("ollama", new OllamaProvider());
    this.providers.set("openai", new OpenAIProvider());
    this.providers.set("gemini", new GeminiProvider());
    this.providers.set("groq", new GroqProvider());
    this.providers.set("anthropic", new AnthropicProvider());
    this.providers.set("demo", new DemoProvider());
    this.order = readOrder();
    this.health = {
      ollama: "unknown",
      openai: "unknown",
      gemini: "unknown",
      groq: "unknown",
      anthropic: "unknown",
      demo: "healthy",
    };
    this.demoMode = (import.meta.env.VITE_START_IN_DEMO_MODE ?? "true") === "true";
  }

  getOrder(): ProviderName[] {
    return [...this.order];
  }

  getHealth(): ProviderHealthMap {
    return { ...this.health };
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }

  setDemoMode(enabled: boolean): void {
    this.demoMode = enabled;
    this.notify();
  }

  onHealthChange(listener: (h: ProviderHealthMap) => void): () => void {
    this.healthListeners.add(listener);
    return () => {
      this.healthListeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getHealth();
    for (const listener of this.healthListeners) {
      listener(snapshot);
    }
  }

  async refreshHealth(): Promise<void> {
    await Promise.all(
      this.order.map(async (name) => {
        const provider = this.providers.get(name);
        if (!provider) return;
        try {
          const ok = await provider.isAvailable();
          this.health[name] = ok ? "healthy" : "unhealthy";
        } catch {
          this.health[name] = "unhealthy";
        }
      }),
    );
    this.notify();
  }

  private activeOrder(): ProviderName[] {
    if (this.demoMode) return ["demo"];
    return this.order;
  }

  async generate<T = string>(params: GenerateParams<T>): Promise<GenerateResult<T>> {
    const errors: string[] = [];
    for (const name of this.activeOrder()) {
      const provider = this.providers.get(name);
      if (!provider) continue;
      if (this.health[name] === "unhealthy") {
        params.onAttempt?.({
          provider: name,
          status: "skipped",
          reason: "Provider marked unhealthy.",
        });
        errors.push(`${name}: marked unhealthy`);
        continue;
      }
      const attemptStartedAt = performance.now();
      params.onAttempt?.({
        provider: name,
        status: "started",
      });
      try {
        const result = await provider.generate(params);
        params.onAttempt?.({
          provider: name,
          status: "succeeded",
          model: result.model,
          wallTimeMs: result.wallTimeMs,
        });
        return result;
      } catch (err) {
        params.onAttempt?.({
          provider: name,
          status: "failed",
          reason: err instanceof Error ? err.message : "Unknown provider failure.",
          errorName: err instanceof Error ? err.name : "UnknownError",
          wallTimeMs: performance.now() - attemptStartedAt,
          ...(err instanceof SchemaValidationError
            ? {
                schemaPath: err.schemaPath,
                schemaMessage: err.schemaMessage,
                schemaSummary: err.schemaSummary,
                schemaRawSummary: err.schemaRawSummary,
              }
            : {}),
        });
        if (err instanceof SchemaValidationError) {
          errors.push(err.message);
          if (!params.failoverOnSchemaError) {
            throw err;
          }
          continue;
        }
        if (err instanceof ProviderUnavailableError) {
          errors.push(err.message);
          this.health[name] = "unhealthy";
          this.notify();
          continue;
        }
        errors.push(`${name}: ${(err as Error).message}`);
        this.health[name] = "unhealthy";
        this.notify();
        continue;
      }
    }
    throw new ProviderUnavailableError(
      "demo",
      `All providers failed: ${errors.join(" | ")}`,
    );
  }

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    for (const name of this.activeOrder()) {
      const provider = this.providers.get(name);
      if (!provider?.supportsStreaming) continue;
      if (this.health[name] === "unhealthy") continue;
      try {
        for await (const event of provider.stream(params)) {
          yield event;
        }
        return;
      } catch {
        this.health[name] = "unhealthy";
        this.notify();
        continue;
      }
    }
    throw new ProviderUnavailableError("demo", "No streaming provider available");
  }

  async embed(texts: string[]): Promise<EmbedResult> {
    for (const name of this.activeOrder()) {
      const provider = this.providers.get(name);
      if (!provider?.supportsEmbeddings) continue;
      if (this.health[name] === "unhealthy") continue;
      try {
        return await provider.embed(texts);
      } catch {
        this.health[name] = "unhealthy";
        this.notify();
        continue;
      }
    }
    throw new ProviderUnavailableError("demo", "No embedding provider available");
  }
}

// Module singleton — one orchestrator per app.
let orchestratorSingleton: LlmOrchestrator | null = null;
export function getOrchestrator(): LlmOrchestrator {
  if (!orchestratorSingleton) {
    orchestratorSingleton = new LlmOrchestrator();
  }
  return orchestratorSingleton;
}
