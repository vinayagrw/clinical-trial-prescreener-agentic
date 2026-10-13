import React from "react";

export interface SkeletonProps {
  variant?: "text" | "circle" | "card";
  width?: number | string;
  height?: number | string;
}

export function SkeletonLoader({
  variant = "text",
  width,
  height,
}: SkeletonProps) {
  const classNames = ["skeleton"];

  if (variant === "text") classNames.push("skeleton--text");
  if (variant === "circle") classNames.push("skeleton--circle");

  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;

  return <div className={classNames.join(" ")} style={style} />;
}
