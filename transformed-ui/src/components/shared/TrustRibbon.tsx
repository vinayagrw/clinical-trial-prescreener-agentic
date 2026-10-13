import React from "react";
import { StatusDot } from "./StatusDot";

export interface TrustRibbonProps {
  freshness: string;
  evidenceCount: number;
  reviewer?: string;
  confidence?: string;
}

export function TrustRibbon({
  freshness,
  evidenceCount,
  reviewer,
  confidence,
}: TrustRibbonProps) {
  return (
    <div className="trust-ribbon">
      <span className="trust-ribbon__item">
        <StatusDot status={freshness} size="sm" />
        {freshness}
      </span>

      <span className="trust-ribbon__divider" />

      <span className="trust-ribbon__item">
        {evidenceCount} {evidenceCount === 1 ? "source" : "sources"}
      </span>

      {reviewer && (
        <>
          <span className="trust-ribbon__divider" />
          <span className="trust-ribbon__item">{reviewer}</span>
        </>
      )}

      {confidence && (
        <>
          <span className="trust-ribbon__divider" />
          <span className="trust-ribbon__item">{confidence}</span>
        </>
      )}
    </div>
  );
}
