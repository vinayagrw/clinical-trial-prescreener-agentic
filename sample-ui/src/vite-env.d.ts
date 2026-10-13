/// <reference types="vite/client" />

/*
 * Typed environment variables for import.meta.env.
 *
 * Every `VITE_*` referenced in the app must be declared here to keep
 * strict TypeScript happy. All of these are optional — the orchestrator
 * has defaults or falls back to demo mode when any are missing.
 */
interface ImportMetaEnv {
  readonly VITE_LLM_PROVIDER_ORDER?: string;

  readonly VITE_OLLAMA_CHAT_MODEL?: string;
  readonly VITE_OLLAMA_EMBED_MODEL?: string;

  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_OPENAI_CHAT_MODEL?: string;
  readonly VITE_OPENAI_EMBED_MODEL?: string;

  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GEMINI_CHAT_MODEL?: string;
  readonly VITE_GEMINI_EMBED_MODEL?: string;

  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_GROQ_CHAT_MODEL?: string;

  readonly VITE_CONCURRENCY_OLLAMA?: string;
  readonly VITE_CONCURRENCY_GEMINI?: string;
  readonly VITE_CONCURRENCY_GROQ?: string;

  readonly VITE_START_IN_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
declare const __BUILD_STAMP__: string;
