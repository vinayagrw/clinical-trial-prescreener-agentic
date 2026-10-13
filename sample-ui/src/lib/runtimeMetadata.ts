export type AppRuntimeMode = "dev" | "preview";

export interface RuntimeMetadata {
  appVersion: string;
  buildMode: AppRuntimeMode;
  buildStamp: string;
  clientPort: string | null;
}

export function getRuntimeMetadata(): RuntimeMetadata {
  const clientPort =
    typeof window !== "undefined" ? window.location.port || null : null;

  return {
    appVersion: __APP_VERSION__,
    buildMode: import.meta.env.DEV ? "dev" : "preview",
    buildStamp: __BUILD_STAMP__,
    clientPort,
  };
}
