import React from "react";
import { trials } from "../../data/index";

export interface FilterBarValue {
  timeRange: string;
  trial: string;
  diseaseArea: string;
}

interface FilterBarProps {
  value: FilterBarValue;
  onChange: (value: FilterBarValue) => void;
}

// NOTE: timeRange and diseaseArea are not wired to the charts below —
// they'd need real time-series + disease-tagged data to be meaningful. The
// trial filter IS wired to TrialHealthBar via InsightsPage. We surface that
// limitation with a hover tooltip rather than pretending every select works.
const DEMO_ONLY_TITLE = "Demo filter — UI preview only";

export function FilterBar({ value, onChange }: FilterBarProps) {
  const update = (patch: Partial<FilterBarValue>) => onChange({ ...value, ...patch });

  return (
    <div className="filter-bar">
      <select
        className="filter-bar__select"
        value={value.timeRange}
        onChange={(e) => update({ timeRange: e.target.value })}
        title={DEMO_ONLY_TITLE}
      >
        <option value="7">Last 7 Days</option>
        <option value="30">Last 30 Days</option>
        <option value="90">Last 90 Days</option>
      </select>

      <select
        className="filter-bar__select"
        value={value.trial}
        onChange={(e) => update({ trial: e.target.value })}
      >
        <option value="all">All Trials</option>
        {trials.map((t) => (
          <option key={t.id} value={t.id}>
            {t.shortCode}
          </option>
        ))}
      </select>

      <select
        className="filter-bar__select"
        value={value.diseaseArea}
        onChange={(e) => update({ diseaseArea: e.target.value })}
        title={DEMO_ONLY_TITLE}
      >
        <option value="all">All</option>
        <option value="nsclc">NSCLC</option>
        <option value="colorectal">Colorectal</option>
        <option value="tnbc">TNBC</option>
      </select>
    </div>
  );
}
