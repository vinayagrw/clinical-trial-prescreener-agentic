import React from "react";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 28,
  color = "var(--teal-500)",
}: SparklineProps) {
  if (data.length < 2) return null;

  const padding = 2;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * plotWidth;
    const y = padding + plotHeight - ((value - min) / range) * plotHeight;
    return `${x},${y}`;
  });

  const lastPoint = points[points.length - 1].split(",");
  const lastX = parseFloat(lastPoint[0]);
  const lastY = parseFloat(lastPoint[1]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        className="sparkline__line"
        points={points.join(" ")}
        stroke={color}
      />
      <circle
        className="sparkline__dot"
        cx={lastX}
        cy={lastY}
        fill={color}
      />
    </svg>
  );
}
