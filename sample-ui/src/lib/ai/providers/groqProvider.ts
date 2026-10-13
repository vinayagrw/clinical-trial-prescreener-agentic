/*
 * Groq provider — OpenAI-compatible REST API.
 *
 * Free tier: 30 RPM on llama-3.3-70b-versatile, extremely fast inference
 * (sub-second for most prompts). Groq does NOT offer embeddings — use
 * Ollama (nomic-embed-text) or Gemini (text-embedding-004) instead.
 *
 * Get a key: https://console.groq.com/keys
 * Set VITE_GROQ_API_KEY in .env.local.
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

const API_KEY = import.meta.env.VITE_GROQ_API_KEY ?? "";
const CHAT_MODEL = import.meta.env.VITE_GROQ_CHAT_MODEL ?? "llama-3.3-70b-versatile";
const BASE = "https://api.groq.com/openai/v1";

export class GroqProvider implements LLMProvider {
  readonly name = "groq" as const;
  readonly supportsStreaming = true;
  readonly supportsEmbeddings = false;

  async isAvailable(): Promise<boolean> {
    return !!API_KEY;
  }

  async generate<T = string>(params: GenerateParams<T>): Promise<GenerateResult<T>> {
    if (!API_KEY) {
      throw new ProviderUnavailableError("groq", "no API key configured");
    }
    const started = performance.now();
    const hasSchema = !!params.schema;

    try {
      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          temperature: params.temperature ?? 0,
          max_tokens: params.maxTokens ?? 2048,
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
          ...(hasSchema ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: params.signal,
      });
      if (!res.ok) {
        throw new ProviderUnavailableError("groq", `HTTP ${res.status}`);
      }
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = body?.choices?.[0]?.message?.content ?? "";
      if (hasSchema && params.schema) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch (cause) {
          throw new SchemaValidationError("groq", content, cause);
        }
        const validation = params.schema.safeParse(parsed);
        if (!validation.success) {
          throw new SchemaValidationError("groq", parsed, validation.error);
        }
        return {
          value: validation.data,
          provider: "groq",
          model: CHAT_MODEL,
          wallTimeMs: performance.now() - started,
        };
      }
      return {
        value: content as unknown as T,
        provider: "groq",
        model: CHAT_MODEL,
        wallTimeMs: performance.now() - started,
      };
    } catch (err) {
      if (err instanceof SchemaValidationError) throw err;
      throw new ProviderUnavailableError("groq", (err as Error).message, err);
    }
  }

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    if (!API_KEY) {
      throw new ProviderUnavailableError("groq", "no API key configured");
    }
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: params.temperature ?? 0,
        stream: true,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
      signal: params.signal,
    });
    if (!res.ok || !res.body) {
      throw new ProviderUnavailableError("groq", `HTTP ${res.status}`);
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
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          yield { token: "", provider: "groq", model: CHAT_MODEL, done: true };
          return;
        }
        try {
          const obj = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const token = obj.choices?.[0]?.delta?.content ?? "";
          if (token) {
            yield { token, provider: "groq", model: CHAT_MODEL, done: false };
          }
        } catch {
          // swallow partial JSON
        }
      }
    }
  }

  async embed(_texts: string[]): Promise<EmbedResult> {
    throw new ProviderUnavailableError("groq", "Groq does not support embeddings");
  }
}
