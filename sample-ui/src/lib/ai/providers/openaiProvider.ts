/*
 * OpenAI provider - direct REST API calls from the sample UI.
 *
 * This is intentionally browser-side for the prototype so the AI Features
 * page can exercise live failover without a separate gateway. Production
 * traffic should still route through the Model Gateway instead of exposing
 * provider keys in the client.
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
import {
  normalizeOpenAIStructuredOutput,
  zodSchemaToOpenAIStrictJsonSchema,
} from "./zodJsonSchema";

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? "";
const CHAT_MODEL = import.meta.env.VITE_OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";
const EMBED_MODEL =
  import.meta.env.VITE_OPENAI_EMBED_MODEL ?? "text-embedding-3-small";
const BASE = "https://api.openai.com/v1";

type ChatMessageContent =
  | string
  | Array<{
      type?: string;
      text?: string;
    }>;

function readChatContent(content: ChatMessageContent | undefined): string {
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

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: { message?: string };
    };
    return body.error?.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function prefersMaxCompletionTokens(model: string): boolean {
  return /^(gpt-5|o[1-9])/i.test(model.trim());
}

function buildStructuredOutputName(featureKey: string): string {
  const sanitized = featureKey
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "structured_output";
}

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai" as const;
  readonly supportsStreaming = true;
  readonly supportsEmbeddings = true;

  async isAvailable(): Promise<boolean> {
    return !!API_KEY;
  }

  async generate<T = string>(params: GenerateParams<T>): Promise<GenerateResult<T>> {
    if (!API_KEY) {
      throw new ProviderUnavailableError("openai", "no API key configured");
    }
    const started = performance.now();
    const hasSchema = !!params.schema;

    try {
      const requestBody: Record<string, unknown> = {
        model: CHAT_MODEL,
        temperature: params.temperature ?? 0,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      };

      requestBody[
        prefersMaxCompletionTokens(CHAT_MODEL)
          ? "max_completion_tokens"
          : "max_tokens"
      ] = params.maxTokens ?? 2048;

      if (hasSchema && params.schema) {
        requestBody.response_format = {
          type: "json_schema",
          json_schema: {
            name: buildStructuredOutputName(params.featureKey),
            strict: true,
            schema: zodSchemaToOpenAIStrictJsonSchema(params.schema),
          },
        };
      }

      const res = await fetch(`${BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: params.signal,
      });

      if (!res.ok) {
        throw new ProviderUnavailableError(
          "openai",
          await readErrorMessage(res),
        );
      }

      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: ChatMessageContent } }>;
      };
      const content = readChatContent(body?.choices?.[0]?.message?.content);

      if (hasSchema && params.schema) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
        } catch (cause) {
          throw new SchemaValidationError("openai", content, cause);
        }
        const normalized = normalizeOpenAIStructuredOutput(params.schema, parsed);
        const validation = params.schema.safeParse(normalized);
        if (!validation.success) {
          throw new SchemaValidationError("openai", normalized, validation.error);
        }
        return {
          value: validation.data,
          provider: "openai",
          model: CHAT_MODEL,
          wallTimeMs: performance.now() - started,
        };
      }

      return {
        value: content as unknown as T,
        provider: "openai",
        model: CHAT_MODEL,
        wallTimeMs: performance.now() - started,
      };
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        throw err;
      }
      if (err instanceof ProviderUnavailableError) {
        throw err;
      }
      throw new ProviderUnavailableError("openai", (err as Error).message, err);
    }
  }

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    if (!API_KEY) {
      throw new ProviderUnavailableError("openai", "no API key configured");
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
      throw new ProviderUnavailableError(
        "openai",
        res.ok ? "stream body missing" : await readErrorMessage(res),
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) {
          continue;
        }
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          yield { token: "", provider: "openai", model: CHAT_MODEL, done: true };
          return;
        }
        try {
          const body = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: ChatMessageContent };
            }>;
          };
          const token = readChatContent(body.choices?.[0]?.delta?.content);
          if (token) {
            yield {
              token,
              provider: "openai",
              model: CHAT_MODEL,
              done: false,
            };
          }
        } catch {
          // Swallow partial JSON chunks.
        }
      }
    }
    yield { token: "", provider: "openai", model: CHAT_MODEL, done: true };
  }

  async embed(texts: string[]): Promise<EmbedResult> {
    if (!API_KEY) {
      throw new ProviderUnavailableError("openai", "no API key configured");
    }
    const started = performance.now();
    const res = await fetch(`${BASE}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: texts,
      }),
    });

    if (!res.ok) {
      throw new ProviderUnavailableError(
        "openai",
        await readErrorMessage(res),
      );
    }

    const body = (await res.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const embeddings = (body.data ?? []).map((item) => item.embedding ?? []);
    if (embeddings.length !== texts.length || embeddings.some((e) => e.length === 0)) {
      throw new ProviderUnavailableError(
        "openai",
        "embedding response missing vectors",
      );
    }

    return {
      embeddings,
      provider: "openai",
      model: EMBED_MODEL,
      wallTimeMs: performance.now() - started,
    };
  }
}
