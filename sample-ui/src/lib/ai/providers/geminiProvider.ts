/*
 * Google Gemini provider — uses @google/generative-ai SDK.
 *
 * Free tier: 15 RPM on gemini-1.5-flash, 1M tokens/day.
 * Embeddings: 1500 RPM on text-embedding-004. Free.
 *
 * Get a key: https://aistudio.google.com/app/apikey
 * Set VITE_GEMINI_API_KEY in .env.local.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  EmbedResult,
  GenerateParams,
  GenerateResult,
  LLMProvider,
  StreamEvent,
  StreamParams,
} from "./types";
import { ProviderUnavailableError, SchemaValidationError } from "./types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? "";
const CHAT_MODEL = import.meta.env.VITE_GEMINI_CHAT_MODEL ?? "gemini-2.0-flash";
const EMBED_MODEL = import.meta.env.VITE_GEMINI_EMBED_MODEL ?? "text-embedding-004";

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini" as const;
  readonly supportsStreaming = true;
  readonly supportsEmbeddings = true;
  private client: GoogleGenerativeAI | null;

  constructor() {
    this.client = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.client;
  }

  async generate<T = string>(params: GenerateParams<T>): Promise<GenerateResult<T>> {
    if (!this.client) {
      throw new ProviderUnavailableError("gemini", "no API key configured");
    }
    const started = performance.now();
    const hasSchema = !!params.schema;

    try {
      const model = this.client.getGenerativeModel({
        model: CHAT_MODEL,
        systemInstruction: params.system,
        generationConfig: {
          temperature: params.temperature ?? 0,
          maxOutputTokens: params.maxTokens ?? 2048,
          ...(hasSchema
            ? {
                responseMimeType: "application/json",
              }
            : {}),
        },
      });

      const res = await model.generateContent(params.user);
      const text = res.response.text();

      if (hasSchema && params.schema) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch (cause) {
          throw new SchemaValidationError("gemini", text, cause);
        }
        const validation = params.schema.safeParse(parsed);
        if (!validation.success) {
          throw new SchemaValidationError("gemini", parsed, validation.error);
        }
        return {
          value: validation.data,
          provider: "gemini",
          model: CHAT_MODEL,
          wallTimeMs: performance.now() - started,
        };
      }

      return {
        value: text as unknown as T,
        provider: "gemini",
        model: CHAT_MODEL,
        wallTimeMs: performance.now() - started,
      };
    } catch (err) {
      if (err instanceof SchemaValidationError) throw err;
      throw new ProviderUnavailableError("gemini", (err as Error).message, err);
    }
  }

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    if (!this.client) {
      throw new ProviderUnavailableError("gemini", "no API key configured");
    }
    const model = this.client.getGenerativeModel({
      model: CHAT_MODEL,
      systemInstruction: params.system,
      generationConfig: { temperature: params.temperature ?? 0 },
    });
    try {
      const res = await model.generateContentStream(params.user);
      for await (const chunk of res.stream) {
        const token = chunk.text();
        if (token) {
          yield { token, provider: "gemini", model: CHAT_MODEL, done: false };
        }
      }
      yield { token: "", provider: "gemini", model: CHAT_MODEL, done: true };
    } catch (err) {
      throw new ProviderUnavailableError("gemini", (err as Error).message, err);
    }
  }

  async embed(texts: string[]): Promise<EmbedResult> {
    if (!this.client) {
      throw new ProviderUnavailableError("gemini", "no API key configured");
    }
    const started = performance.now();
    const model = this.client.getGenerativeModel({ model: EMBED_MODEL });
    const embeddings: number[][] = [];
    try {
      for (const text of texts) {
        const res = await model.embedContent(text);
        embeddings.push(res.embedding.values);
      }
    } catch (err) {
      throw new ProviderUnavailableError("gemini", (err as Error).message, err);
    }
    return {
      embeddings,
      provider: "gemini",
      model: EMBED_MODEL,
      wallTimeMs: performance.now() - started,
    };
  }
}
