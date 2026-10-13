type Tone = "teal" | "moss" | "amber" | "brick" | "slate" | "paper";

interface StatusChipProps {
  label: string;
  tone?: Tone;
  compact?: boolean;
}

export function StatusChip({
  label,
  tone = "slate",
  compact = false
}: StatusChipProps) {
  return (
    <span
      className={`status-chip status-chip--${tone} ${
        compact ? "status-chip--compact" : ""
      }`}
    >
      {label}
    </span>
  );
}
