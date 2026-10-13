/*
 * Demo provider — fixture-based fallback that's always available.
 *
 * Schema-bound generate() calls resolve through `demoFixtures/index.ts`,
 * which hands back a typed fixture matching whatever feature asked (F1
 * decomposition, F3 per-criterion verdict, F5 Ask Agent response, etc).
 * If no fixture matches the request, we still throw — silent empty output
 * would make bugs in higher layers invisible.
 *
 * Streaming replays the resolved fixture JSON character-by-character so
 * the Ask Agent widget gets the same "typing" UX in demo mode as live.
 * Embeddings are deterministic 128-dim hash vectors — enough for cosine
 * similarity in F2 without needing a network call.
 */

import { resolveDemoFixture } from "./demoFixtures";
import type {
  EmbedResult,
  GenerateParams,
  GenerateResult,
  LLMProvider,
  StreamEvent,
  StreamParams,
} from "./types";

export class DemoProvider implements LLMProvider {
  readonly name = "demo" as const;
  readonly supportsStreaming = true;
  readonly supportsEmbeddings = true;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generate<T = string>(params: GenerateParams<T>): Promise<GenerateResult<T>> {
    const wallTimeMs = 80 + Math.random() * 220;
    await new Promise((r) => setTimeout(r, wallTimeMs));
    if (params.schema) {
      const fixture = resolveDemoFixture<T>(params);
      if (fixture === undefined) {
        throw new Error(
          `[demo] No fixture registered for featureKey="${params.featureKey}". ` +
            "Add one in src/lib/ai/providers/demoFixtures/, or run live with Ollama/Gemini/Groq.",
        );
      }
      return {
        value: fixture,
        provider: "demo",
        model: "demo-fixture",
        wallTimeMs,
      };
    }
    return {
      value: `(demo response for ${params.featureKey})` as unknown as T,
      provider: "demo",
      model: "demo-fixture",
      wallTimeMs,
    };
  }

  async *stream(params: StreamParams): AsyncIterable<StreamEvent> {
    // Try to resolve a fixture against the stream request so the Ask Agent
    // can "stream" a canned answer. If there's no fixture, fall back to a
    // plain placeholder message.
    let message: string;
    try {
      const fixture = resolveDemoFixture<unknown>({
        featureKey: params.featureKey,
        system: params.system,
        user: params.user,
      });
      message =
        fixture === undefined
          ? `(demo stream for ${params.featureKey})`
          : JSON.stringify(fixture);
    } catch {
      message = `(demo stream for ${params.featureKey})`;
    }
    for (const ch of message) {
      await new Promise((r) => setTimeout(r, 8));
      yield { token: ch, provider: "demo", model: "demo-fixture", done: false };
    }
    yield { token: "", provider: "demo", model: "demo-fixture", done: true };
  }

  async embed(texts: string[]): Promise<EmbedResult> {
    // Deterministic 128-dim hash embeddings so cosine similarity has something
    // meaningful to chew on until real embeddings are available.
    const embeddings = texts.map((t) => hashEmbedding(t, 128));
    return {
      embeddings,
      provider: "demo",
      model: "demo-fixture",
      wallTimeMs: 10,
    };
  }
}

function hashEmbedding(text: string, dim: number): number[] {
  const out = new Array<number>(dim).fill(0);
  const normalized = text.toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    out[(code * 31 + i) % dim] += 1;
  }
  const norm = Math.sqrt(out.reduce((a, b) => a + b * b, 0)) || 1;
  return out.map((v) => v / norm);
}
