import React from "react";

export interface AnimatedCounterProps {
  value: number;
}

export function AnimatedCounter({ value }: AnimatedCounterProps) {
  return <span className="animated-counter">{value}</span>;
}
