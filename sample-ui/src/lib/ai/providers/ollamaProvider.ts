/*
 * Ollama provider — talks to a local Ollama daemon via the Vite dev server
 * proxy at /api/ollama → http://localhost:11434. No API key required.
 *
 * Setup:
 *   1. Install Ollama: https://ollama.com
 *   2. Pull the chat model: `ollama pull llama3.2:3b`
 *   3. Pull the embedding model: `ollama pull nomic-embed-text`
 *   4. Ensure `ollama serve` is running (auto-starts on most platforms)
 *
 * The proxy strips the /api/ollama prefix, so our requests hit
 * http://localhost:11434/api/chat, /api/tags, /api/embeddings.
 */

import type {
  EmbedResult,
  GenerateParams,
  GenerateResult,
  LLMProvider,
  StreamEvent,
  StreamParams,
} from "./types";
import { ProviderUnavailableError, SchemaValidationError } from "./types";

const BASE = "/api/ollama";
const CHAT_MODEL = import.meta.env.VITE_OLLAMA_CHAT_MODEL ?? "llama3.2:3b";
const EMBED_MODEL = import.meta.env.VITE_OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama" as const;
  readonly supportsStreaming = true;
  readonly supportsEmbeddings = true;

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${BASE}/api/tags`, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate<T = string>(params: GenerateParams<T>): Promise<GenerateResult<T>> {
    const started = performance.now();
    const hasSchema = !!params.schema;
    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CHAT_MODEL,
          stream: false,
          format: hasSchema ? "json" : undefined,
          options: {
            temperature: params.temperature ?? 0,
            num_predict: params.maxTokens ?? 1024,
            num_ctx: 8192,
          },
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
        }),
        signal: params.signal,
      });

      if (!res.ok) {
        throw new ProviderUnavailableError("ollama", `HTTP ${res.status}`);
      }

      const body = (await res.json()) as { message?: { content?: string } };
      const content = body?.message?.content ?? "";

      if (hasSchema && params.schema) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch (cause) {
          throw new SchemaValidationError("ollama", content, cause);
        }
        const validation = params.schema.safeParse(parsed);
        if (!validation.success) {
          throw new SchemaValidationError("ollama", parsed, validation.error);
        }
        return {
          value: validation.data,
          provider: "ollama",
          model: CHAT_MODEL,
          wallTimeMs: performance.now() - started,
        };
      }

      return {
        value: content as unknown as T,
        provider: "ollama",
        model: CHAT_MODEL,
        wallTimeMs: performance.now() - started,
      };
    } catch (err) {
      if (err instanceof ProviderUnavailableError || err instanceof SchemaValidationError) {
        throw err;
      }
      throw new ProviderUnavailableError("ollama", (err as Error).message, err);
    }
  }

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: CHAT_MODEL,
        stream: true,
        options: { temperature: params.temperature ?? 0, num_ctx: 8192 },
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
      signal: params.signal,
    });

    if (!res.ok || !res.body) {
      throw new ProviderUnavailableError("ollama", `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed) as {
            message?: { content?: string };
            done?: boolean;
          };
          yield {
            token: obj.message?.content ?? "",
            provider: "ollama",
            model: CHAT_MODEL,
            done: !!obj.done,
          };
        } catch {
          // swallow partial JSON
        }
      }
    }
  }

  async embed(texts: string[]): Promise<EmbedResult> {
    const started = performance.now();
    const embeddings: number[][] = [];
    for (const text of texts) {
      const res = await fetch(`${BASE}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
      });
      if (!res.ok) {
        throw new ProviderUnavailableError("ollama", `embed HTTP ${res.status}`);
      }
      const body = (await res.json()) as { embedding?: number[] };
      if (!body.embedding) {
        throw new ProviderUnavailableError("ollama", "no embedding in response");
      }
      embeddings.push(body.embedding);
    }
    return {
      embeddings,
      provider: "ollama",
      model: EMBED_MODEL,
      wallTimeMs: performance.now() - started,
    };
  }
}
