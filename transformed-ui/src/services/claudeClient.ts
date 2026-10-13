// Low-level Claude API client. Calls go through the Vite dev proxy defined in
// `vite.config.ts`, which injects the `x-api-key` and `anthropic-version`
// headers server-side so the API key never touches the browser bundle.
//
// Production note: the proxy is a dev-server feature. If the demo is deployed
// behind a real server, replace the fetch URL with that server's endpoint.

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeCallOptions {
  system: string;
  messages: ClaudeMessage[];
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface ClaudeCallResult {
  text: string;
  stopReason?: string;
  model: string;
}

export class ClaudeTimeoutError extends Error {
  constructor() {
    super("Claude API timed out");
    this.name = "ClaudeTimeoutError";
  }
}

export class ClaudeApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ClaudeApiError";
    this.status = status;
  }
}

const DEFAULT_MODEL =
  (import.meta.env.VITE_CLAUDE_MODEL as string | undefined) ??
  "claude-sonnet-4-5-20250929";

const DEFAULT_TIMEOUT_MS = 6000;

export async function callClaude(
  options: ClaudeCallOptions
): Promise<ClaudeCallResult> {
  const {
    system,
    messages,
    model = DEFAULT_MODEL,
    maxTokens = 1024,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ClaudeApiError(
        response.status,
        `Claude API ${response.status}: ${body.slice(0, 200)}`
      );
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
      model?: string;
    };

    const text = (data.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text!)
      .join("");

    return {
      text,
      stopReason: data.stop_reason,
      model: data.model ?? model,
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ClaudeTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
