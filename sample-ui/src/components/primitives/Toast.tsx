/*
 * Toast primitive — wraps @radix-ui/react-toast.
 *
 * The house toast pattern is: short transient banner in the top-right,
 * auto-dismiss in ~6s, with an optional undo action that extends the
 * dismiss timer. Every destructive action (override, finalize, bulk apply)
 * must pair with an undo-capable toast — see plan M4 section for the rule.
 *
 * The ToastProvider + ToastViewport pair is mounted once in ToastHost.tsx
 * which lives in src/components/shell/.
 */

import { forwardRef, type ReactNode } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";

export const ToastProvider = ToastPrimitive.Provider;
export const ToastRoot = ToastPrimitive.Root;
export const ToastTitle = ToastPrimitive.Title;
export const ToastDescription = ToastPrimitive.Description;
export const ToastAction = ToastPrimitive.Action;
export const ToastClose = ToastPrimitive.Close;

export interface ToastViewportProps {
  label?: string;
}

/** The landing zone for all toasts. Mount once near the app root. */
export const ToastViewport = forwardRef<HTMLOListElement, ToastViewportProps>(
  ({ label = "Notifications" }, ref) => (
    <ToastPrimitive.Viewport
      ref={ref}
      label={label}
      className="ctp-toast-viewport"
    />
  ),
);
ToastViewport.displayName = "ToastViewport";

export interface ToastProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  tone?: "neutral" | "success" | "warning" | "critical";
  duration?: number;
  /** Actions rendered at the bottom of the toast. Usually a single Undo. */
  actions?: ReactNode;
}

export function Toast({
  open,
  onOpenChange,
  title,
  description,
  tone = "neutral",
  duration = 6000,
  actions,
}: ToastProps) {
  return (
    <ToastRoot
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
      className={`ctp-toast ctp-toast-${tone}`}
    >
      <ToastTitle className="ctp-toast-title">{title}</ToastTitle>
      {description ? (
        <ToastDescription className="ctp-toast-description">
          {description}
        </ToastDescription>
      ) : null}
      {actions ? <div className="ctp-toast-actions">{actions}</div> : null}
      <ToastClose className="ctp-toast-close" aria-label="Dismiss">×</ToastClose>
    </ToastRoot>
  );
}
