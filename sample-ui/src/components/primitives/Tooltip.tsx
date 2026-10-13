/*
 * Tooltip primitive — wraps @radix-ui/react-tooltip.
 *
 * House rule: tooltips carry supplementary text only. Never put load-bearing
 * info in a tooltip; mobile + touch + screen readers will all miss it.
 *
 * TooltipProvider must be mounted once at the app root (main.tsx); wrapping
 * each tooltip individually causes double delay timers.
 */

import { forwardRef, type ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps {
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ children, side = "top", align = "center", sideOffset = 4 }, ref) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        side={side}
        align={align}
        sideOffset={sideOffset}
        className="ctp-tooltip-content"
      >
        {children}
        <TooltipPrimitive.Arrow className="ctp-tooltip-arrow" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  ),
);
TooltipContent.displayName = "TooltipContent";
