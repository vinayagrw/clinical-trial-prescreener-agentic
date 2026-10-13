/*
 * ToastHost — renders the zustand toast queue inside a Radix ToastProvider.
 *
 * Mount once at the app root so any caller can `pushToast()` without
 * threading providers. Individual toasts render themselves via the Toast
 * primitive and are dismissed automatically after `durationMs`.
 *
 * Why a global host instead of a per-feature toaster? Because coordinators
 * can trigger actions from many places (cockpit row menu, review header,
 * command palette, keyboard shortcut) and we want every one of those to
 * reach the same notification channel without a provider tree.
 */

import { ToastProvider, ToastViewport, Toast } from "../primitives";
import { useUiStore } from "../../stores/ui";

export function ToastHost() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          open={true}
          onOpenChange={(open) => {
            if (!open) dismissToast(toast.id);
          }}
          title={toast.title}
          description={toast.description}
          tone={toast.tone}
          duration={toast.durationMs ?? 6000}
          actions={
            toast.undo ? (
              <button
                type="button"
                className="ctp-toast-undo"
                onClick={() => {
                  toast.undo?.();
                  dismissToast(toast.id);
                }}
              >
                {toast.undoLabel ?? "Undo"}
              </button>
            ) : undefined
          }
        />
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
