import React from "react";

export interface DeepReviewLayoutProps {
  children: [React.ReactNode, React.ReactNode];
}

export function DeepReviewLayout({ children }: DeepReviewLayoutProps) {
  return (
    <div className="deep-review__split">
      <div className="deep-review__criteria">{children[0]}</div>
      <div>{children[1]}</div>
    </div>
  );
}
