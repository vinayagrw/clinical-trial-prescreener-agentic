/*
 * DropdownMenu primitive — wraps @radix-ui/react-dropdown-menu.
 *
 * Used for action menus hanging off buttons (bulk actions, row-level
 * context menus, queue owner reassign). Radix gives us arrow-key nav,
 * type-ahead jumping, and nested submenus.
 */

import { forwardRef, type ReactNode } from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuPortal = DropdownPrimitive.Portal;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;
export const DropdownMenuSub = DropdownPrimitive.Sub;

export interface DropdownMenuContentProps {
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}

export const DropdownMenuContent = forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ children, align = "start", side = "bottom", sideOffset = 6 }, ref) => (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        ref={ref}
        align={align}
        side={side}
        sideOffset={sideOffset}
        className="ctp-menu-content"
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  ),
);
DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps {
  children: ReactNode;
  onSelect?: (event: Event) => void;
  disabled?: boolean;
  /** Render as a destructive (brick-toned) item. */
  tone?: "default" | "destructive";
}

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ children, onSelect, disabled, tone = "default" }, ref) => (
    <DropdownPrimitive.Item
      ref={ref}
      onSelect={onSelect}
      disabled={disabled}
      className={`ctp-menu-item ctp-menu-item-${tone}`}
    >
      {children}
    </DropdownPrimitive.Item>
  ),
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export function DropdownMenuSeparator() {
  return <DropdownPrimitive.Separator className="ctp-menu-separator" />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <DropdownPrimitive.Label className="ctp-menu-label">{children}</DropdownPrimitive.Label>;
}
