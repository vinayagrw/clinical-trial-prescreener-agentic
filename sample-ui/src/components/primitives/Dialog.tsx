/*
 * Dialog primitive — token-styled wrapper over @radix-ui/react-dialog.
 *
 * Radix handles the parts we care about for a11y (focus trap, scroll lock,
 * ARIA roles, Escape to close, aria-labelledby wiring). We add house chrome
 * via plain CSS classes defined in src/styles/primitives.css (to be added
 * alongside this file).
 *
 * Why wrap at all? Two reasons:
 *   1. Every Radix example ships with inline styles or tailwind classes;
 *      we want a single place to apply our token system.
 *   2. The wrapper lets us enforce house API (e.g. `title` prop) so
 *      callers cannot forget to label the dialog.
 */

import { forwardRef, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { VisuallyHidden } from "./VisuallyHidden";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Labels the dialog for screen readers. Required. */
  title: string;
  /** Optional description for assistive tech. */
  description?: string;
  /** Pass `false` to omit the built-in visible title header. */
  showTitle?: boolean;
  children: ReactNode;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  showTitle = true,
  children,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ctp-dialog-overlay" />
        <DialogPrimitive.Content className="ctp-dialog-content">
          {showTitle ? (
            <DialogPrimitive.Title className="ctp-dialog-title">
              {title}
            </DialogPrimitive.Title>
          ) : (
            <VisuallyHidden>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            </VisuallyHidden>
          )}
          {description ? (
            <DialogPrimitive.Description className="ctp-dialog-description">
              {description}
            </DialogPrimitive.Description>
          ) : (
            <VisuallyHidden>
              <DialogPrimitive.Description>
                {title}
              </DialogPrimitive.Description>
            </VisuallyHidden>
          )}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/**
 * A convenience footer that right-aligns action buttons — the most common
 * layout for confirmation dialogs.
 */
export const DialogActions = forwardRef<HTMLDivElement, { children: ReactNode }>(
  ({ children }, ref) => (
    <div ref={ref} className="ctp-dialog-actions">
      {children}
    </div>
  ),
);
DialogActions.displayName = "DialogActions";
