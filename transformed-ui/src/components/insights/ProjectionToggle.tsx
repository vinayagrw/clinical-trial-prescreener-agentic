import React from "react";

// Wow #3 toggle — flips the Insights funnel between the pilot-site discovery
// baseline and the projected pre-screener model. The segment control is
// visually prominent so the executive sponsor knows this is the hero slide.

interface ProjectionToggleProps {
  value: "current" | "projected";
  onChange: (value: "current" | "projected") => void;
}

export function ProjectionToggle({ value, onChange }: ProjectionToggleProps) {
  return (
    <div className="projection-toggle" role="group" aria-label="Workflow comparison">
      <button
        type="button"
        className={
          "projection-toggle__btn" +
          (value === "current" ? " projection-toggle__btn--active" : "")
        }
        onClick={() => onChange("current")}
      >
        Current workflow
      </button>
      <button
        type="button"
        className={
          "projection-toggle__btn" +
          (value === "projected" ? " projection-toggle__btn--active" : "")
        }
        onClick={() => onChange("projected")}
      >
        With pre-screener
        <span className="projection-toggle__tag">projected</span>
      </button>
    </div>
  );
}
