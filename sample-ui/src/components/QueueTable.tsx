import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPatient, getTrial } from "../data/mockData";
import type { Patient, QueueItem, Trial } from "../types";
import { StatusChip } from "./StatusChip";

// Wave C — QueueTable gains click-sortable column headers, full keyboard
// navigation (ArrowUp/Down + Home/End + Enter/Space), and proper ARIA grid
// semantics. The component shell and visual styling (queue-row, queue-row__*)
// stay intact so existing theming and Wave A primitives keep applying; the
// new affordances bolt onto the header row and the row container itself.

interface QueueTableProps {
  items: QueueItem[];
  selectedMatchId: string;
  onSelect: (matchId: string) => void;
}

type SortKey = "patient" | "trial" | "priority" | "owner" | "updated";
type SortDir = "asc" | "desc";

const PRIORITY_RANK: Record<QueueItem["priority"], number> = {
  critical: 4,
  high: 3,
  moderate: 2,
  watch: 1
};

// Parse "12 minutes ago" / "2 hours ago" / "3 days ago" into minutes so the
// "Updated" column can sort reliably without a real ISO timestamp in mock
// data. Unknown formats sort to the bottom.
function parseRecencyMinutes(value: string): number {
  const match = value.match(/(\d+)\s*(minute|hour|day|week|month)/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const n = Number.parseInt(match[1] ?? "0", 10);
  const unit = (match[2] ?? "").toLowerCase();
  const mult =
    unit === "minute"
      ? 1
      : unit === "hour"
        ? 60
        : unit === "day"
          ? 1440
          : unit === "week"
            ? 10080
            : 43200;
  return n * mult;
}

function priorityTone(priority: QueueItem["priority"]) {
  switch (priority) {
    case "critical":
      return "brick";
    case "high":
      return "amber";
    case "moderate":
      return "teal";
    default:
      return "paper";
  }
}

function humanize(value: string) {
  return value.replace(/_/g, " ");
}

// Small down-chevron SVG. CSS rotates it 180deg when aria-sort="ascending"
// so the caret visually agrees with the sort direction. Inline (no new deps).
function SortIcon() {
  return (
    <span className="queue-table__sort-indicator" aria-hidden="true">
      <svg viewBox="0 0 10 10" width="10" height="10">
        <path
          d="M2 4 L5 7 L8 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

interface SortableRow {
  item: QueueItem;
  patient: Patient;
  trial: Trial;
}

export function QueueTable({
  items,
  selectedMatchId,
  onSelect
}: QueueTableProps) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rowRefs = useRef<Array<HTMLDivElement | null>>([]);

  const sortedRows = useMemo<SortableRow[]>(() => {
    const hydrated: SortableRow[] = [];
    for (const item of items) {
      const patient = getPatient(item.patientId);
      const trial = getTrial(item.trialId);
      if (patient && trial) {
        hydrated.push({ item, patient, trial });
      }
    }

    const compare = (a: SortableRow, b: SortableRow): number => {
      switch (sortKey) {
        case "patient":
          return a.patient.name.localeCompare(b.patient.name);
        case "trial":
          return a.trial.shortCode.localeCompare(b.trial.shortCode);
        case "priority":
          return PRIORITY_RANK[a.item.priority] - PRIORITY_RANK[b.item.priority];
        case "owner":
          return a.item.owner.localeCompare(b.item.owner);
        case "updated":
          return (
            parseRecencyMinutes(a.item.lastUpdated) -
            parseRecencyMinutes(b.item.lastUpdated)
          );
        default:
          return 0;
      }
    };

    const sorted = [...hydrated].sort(compare);
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [items, sortKey, sortDir]);

  // Keep the focused index in range when the underlying data changes (e.g.
  // the cockpit filter drops rows). Prevents focus pointing at an index past
  // the end of the list after a re-sort or filter change.
  useEffect(() => {
    setFocusedIndex((current) => {
      if (sortedRows.length === 0) return 0;
      return Math.min(current, sortedRows.length - 1);
    });
  }, [sortedRows.length]);

  // When keyboard nav moves focus, gently scroll the new row into view. Use
  // block: "nearest" so rows near the viewport edge nudge in without jumping
  // the whole page.
  useEffect(() => {
    const target = rowRefs.current[focusedIndex];
    if (target) {
      target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [focusedIndex]);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey]
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!sortedRows.length) return;
      const target = event.target as HTMLElement;
      // Let the nested "Open review" <Link> own its own Enter/Space. The
      // grid only handles keyboard events that originate on the grid
      // container itself or on one of the row cells — not on inner
      // interactive elements.
      if (target.closest(".ghost-link")) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, sortedRows.length - 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Home":
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          event.preventDefault();
          setFocusedIndex(sortedRows.length - 1);
          break;
        case "Enter": {
          event.preventDefault();
          const row = sortedRows[focusedIndex];
          if (row) navigate(`/review/${row.item.matchId}`);
          break;
        }
        case " ": {
          event.preventDefault();
          const row = sortedRows[focusedIndex];
          if (row) onSelect(row.item.matchId);
          break;
        }
        default:
          break;
      }
    },
    [sortedRows, focusedIndex, navigate, onSelect]
  );

  const ariaSortFor = (key: SortKey): "ascending" | "descending" | "none" => {
    if (key !== sortKey) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  };

  const renderSortableHeader = (key: SortKey, label: string) => (
    <button
      type="button"
      role="columnheader"
      aria-sort={ariaSortFor(key)}
      className="queue-table__header-cell queue-table__header--sortable"
      onClick={() => handleSort(key)}
    >
      {label}
      <SortIcon />
    </button>
  );

  return (
    <div
      className="queue-table"
      role="grid"
      aria-label="Match queue"
      aria-rowcount={sortedRows.length}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="queue-table__header" role="row">
        {renderSortableHeader("patient", "Patient")}
        {renderSortableHeader("trial", "Primary trial")}
        {renderSortableHeader("priority", "Priority")}
        {renderSortableHeader("owner", "Owner")}
        {renderSortableHeader("updated", "Updated")}
        <span
          role="columnheader"
          aria-sort="none"
          className="queue-table__header-cell"
        >
          Action
        </span>
      </div>

      {sortedRows.map((row, index) => {
        const { item, patient, trial } = row;
        const isFocused = index === focusedIndex;
        const isSelected = selectedMatchId === item.matchId;

        return (
          <div
            key={item.matchId}
            ref={(el) => {
              rowRefs.current[index] = el;
            }}
            role="row"
            aria-selected={isFocused}
            aria-rowindex={index + 1}
            tabIndex={-1}
            className={`queue-row ${isSelected ? "queue-row--selected" : ""} ${
              isFocused ? "queue-table__row--focused" : ""
            }`.trim()}
            onClick={() => {
              setFocusedIndex(index);
              onSelect(item.matchId);
            }}
          >
            <div className="queue-row__patient" role="gridcell">
              <strong>{patient.name}</strong>
              <span>
                {patient.diagnosis} | {patient.nextAppointment}
              </span>
              {item.whyNow ? <span>{item.whyNow}</span> : null}
              <div className="queue-flag-row">
                {item.flags.map((flag) => (
                  <StatusChip key={flag} label={flag} tone="paper" compact />
                ))}
              </div>
            </div>

            <div className="queue-row__trial" role="gridcell">
              <strong>{trial.shortCode}</strong>
              <span>{trial.title}</span>
              <span>{item.trialCount} active options in queue</span>
            </div>

            <div className="queue-row__compact" role="gridcell">
              <StatusChip
                label={`${item.priority} | ${item.urgencyLabel}`}
                tone={priorityTone(item.priority)}
              />
              <span>Score {item.score}</span>
            </div>

            <div className="queue-row__compact" role="gridcell">
              <strong>{item.owner}</strong>
              <span>{item.lastUpdated}</span>
            </div>

            <div className="queue-row__compact" role="gridcell">
              <strong>{item.reviewState}</strong>
              <span>{humanize(item.nextStep)}</span>
              {item.timeInQueue ? <span>{item.timeInQueue} in queue</span> : null}
            </div>

            <div className="queue-row__action" role="gridcell">
              <Link
                className="ghost-link"
                to={`/review/${item.matchId}`}
                onClick={(event) => event.stopPropagation()}
              >
                Open review
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
