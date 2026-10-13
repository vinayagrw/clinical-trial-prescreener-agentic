/*
 * Popover primitive — wraps @radix-ui/react-popover.
 *
 * Used wherever we want a scoped panel anchored to a trigger without the
 * ceremony of a full dialog (focus trap off, Escape closes, click-outside
 * closes). Good for evidence preview, override rationale drawers, and
 * saved views menu.
 */

import { forwardRef, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

export interface PopoverContentProps {
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  /** Set to `false` to suppress the built-in arrow pointer. */
  showArrow?: boolean;
}

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ children, align = "start", side = "bottom", sideOffset = 6, showArrow = true }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="ctp-popover-content"
      >
        {children}
        {showArrow ? <PopoverPrimitive.Arrow className="ctp-popover-arrow" /> : null}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  ),
);
PopoverContent.displayName = "PopoverContent";
