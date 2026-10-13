/*
 * Tabs primitive — wraps @radix-ui/react-tabs.
 *
 * Radix gives us keyboard roving tabindex, arrow-key navigation, and ARIA
 * role/labelling for free. We only add the token-based styling via the
 * ctp-tabs-* class hooks.
 */

import type { ReactNode } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

export interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** Vertical layout instead of the default horizontal strip. */
  orientation?: "horizontal" | "vertical";
}

export function Tabs({
  items,
  value,
  onValueChange,
  orientation = "horizontal",
}: TabsProps) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      orientation={orientation}
      className={`ctp-tabs ctp-tabs-${orientation}`}
    >
      <TabsPrimitive.List className="ctp-tabs-list" aria-label="Tabs">
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className="ctp-tabs-trigger"
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content
          key={item.value}
          value={item.value}
          className="ctp-tabs-content"
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}

// Also re-export primitive pieces for callers that need to build their own
// layout (e.g. agent widget where Tabs-list sits in a different region from
// Tabs-content).
export const TabsRoot = TabsPrimitive.Root;
export const TabsList = TabsPrimitive.List;
export const TabsTrigger = TabsPrimitive.Trigger;
export const TabsContent = TabsPrimitive.Content;
