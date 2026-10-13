import React from "react";

export interface BadgeProps {
  count: number;
}

export function Badge({ count }: BadgeProps) {
  return <span className="badge">{count}</span>;
}
