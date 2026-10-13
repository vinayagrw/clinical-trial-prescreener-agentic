export const LOCAL_API_OFFLINE_MESSAGE =
  "Local API offline. Run npm run dev (or npm run dev:server) to enable patient catalog and trial import.";

function toErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "";
}

export function isLocalApiOfflineError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();

  if (!message) {
    return false;
  }

  return (
    message.includes("local api offline") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("econnrefused") ||
    message.includes("http proxy error") ||
    message.includes("status 502") ||
    message.includes("status 503") ||
    message.includes("status 504")
  );
}

export function normalizeLocalApiError(
  error: unknown,
  fallbackMessage = "Unable to reach the local API.",
): string {
  if (isLocalApiOfflineError(error)) {
    return LOCAL_API_OFFLINE_MESSAGE;
  }

  const message = toErrorMessage(error).trim();
  return message || fallbackMessage;
}
