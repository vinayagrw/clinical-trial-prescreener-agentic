import React from "react";

export interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  return <div className="divider">{label}</div>;
}
