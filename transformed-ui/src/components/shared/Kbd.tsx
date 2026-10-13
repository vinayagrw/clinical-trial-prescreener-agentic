import React from "react";

export interface KbdProps {
  children: React.ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return <kbd className="kbd">{children}</kbd>;
}
