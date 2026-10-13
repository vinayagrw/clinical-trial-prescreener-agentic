/*
 * Anthropic Claude provider — uses @anthropic-ai/sdk.
 *
 * Claude Sonnet is the default model. Anthropic does NOT support embeddings
 * through this SDK — use Gemini or Ollama for embedding tasks.
 *
 * Get a key: https://console.anthropic.com/settings/keys
 * Set VITE_ANTHROPIC_API_KEY in .env.local.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  EmbedResult,
  GenerateParams,
  GenerateResult,
  LLMProvider,
  StreamEvent,
  StreamParams,
} from "./types";
import { ProviderUnavailableError, SchemaValidationError } from "./types";

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY ?? "";
const CHAT_MODEL =
  import.meta.env.VITE_ANTHROPIC_CHAT_MODEL ?? "claude-sonnet-4-5-20250929";

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic" as const;
  readonly supportsStreaming = true;
  readonly supportsEmbeddings = false;
  private client: Anthropic | null;

  constructor() {
    this.client = API_KEY
      ? new Anthropic({ apiKey: API_KEY, dangerouslyAllowBrowser: true })
      : null;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.client;
  }

  async generate<T = string>(
    params: GenerateParams<T>,
  ): Promise<GenerateResult<T>> {
    if (!this.client) {
      throw new ProviderUnavailableError("anthropic", "no API key configured");
    }
    const started = performance.now();
    const hasSchema = !!params.schema;

    try {
      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: params.user },
      ];

      // For structured output, prefill the assistant response with "{" so the
      // model continues with valid JSON.
      if (hasSchema) {
        messages.push({ role: "assistant", content: "{" });
      }

      const response = await this.client.messages.create({
        model: CHAT_MODEL,
        system: params.system,
        messages,
        max_tokens: params.maxTokens ?? 2048,
        temperature: params.temperature ?? 0,
      });

      let text =
        response.content[0].type === "text" ? response.content[0].text : "";

      if (hasSchema && params.schema) {
        // Prepend the "{" that was consumed by the assistant prefill.
        text = "{" + text;
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch (cause) {
          throw new SchemaValidationError("anthropic", text, cause);
        }
        const validation = params.schema.safeParse(parsed);
        if (!validation.success) {
          throw new SchemaValidationError(
            "anthropic",
            parsed,
            validation.error,
          );
        }
        return {
          value: validation.data,
          provider: "anthropic",
          model: CHAT_MODEL,
          wallTimeMs: performance.now() - started,
        };
      }

      return {
        value: text as unknown as T,
        provider: "anthropic",
        model: CHAT_MODEL,
        wallTimeMs: performance.now() - started,
      };
    } catch (err) {
      if (err instanceof SchemaValidationError) throw err;
      throw new ProviderUnavailableError(
        "anthropic",
        (err as Error).message,
        err,
      );
    }
  }

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    if (!this.client) {
      throw new ProviderUnavailableError("anthropic", "no API key configured");
    }
    try {
      const response = await this.client.messages.create({
        model: CHAT_MODEL,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
        max_tokens: 2048,
        temperature: params.temperature ?? 0,
        stream: true,
      });

      for await (const event of response) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield {
            token: event.delta.text,
            provider: "anthropic",
            model: CHAT_MODEL,
            done: false,
          };
        }
      }
      yield { token: "", provider: "anthropic", model: CHAT_MODEL, done: true };
    } catch (err) {
      throw new ProviderUnavailableError(
        "anthropic",
        (err as Error).message,
        err,
      );
    }
  }

  async embed(_texts: string[]): Promise<EmbedResult> {
    throw new ProviderUnavailableError(
      "anthropic",
      "Claude does not support embeddings",
    );
  }
}
