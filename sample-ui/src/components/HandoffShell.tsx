import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { StatusChip } from "./StatusChip";
import { ThemeSwitcher } from "./shell/ThemeSwitcher";

interface HandoffShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  recordId?: string;
  topRight?: ReactNode;
}

const alertCards = [
  {
    id: "runtime-live",
    tone: "action",
    timestamp: "API live",
    title: "Structured SBAR generation",
    detail: "Summaries are generated from the local backend pipeline, not from static fixtures.",
  },
  {
    id: "runtime-disagreement",
    tone: "warning",
    timestamp: "Safety rule",
    title: "Disagreements stay visible",
    detail: "Conflicting service statements are surfaced explicitly instead of being merged into fake consensus.",
  },
  {
    id: "runtime-trace",
    tone: "info",
    timestamp: "Traceability",
    title: "Sentence-level provenance",
    detail: "Every SBAR bullet links back to verbatim quoted evidence and a document-level audit trail.",
  },
] as const;

export function HandoffShell({
  title,
  subtitle,
  children,
  recordId,
  topRight,
}: HandoffShellProps) {
  const navItems = [
    { to: "/cockpit", label: "Trial Workspace" },
    { to: "/ai-reviews", label: "AI Reviews" },
    { to: "/research-digests", label: "Research Digests" },
    { to: "/handoffs", label: "Handoff Worklist" },
    ...(recordId
      ? [
          { to: `/handoffs/${recordId}`, label: "Case Summary" },
          { to: `/handoffs/${recordId}/audit`, label: "Audit Trail" },
        ]
      : []),
  ];

  return (
    <div className="app-shell">
      <aside className="app-nav">
        <div>
          <p className="nav-kicker">Read-only pilot</p>
          <h1>Clinical Handoff Studio</h1>
          <p className="nav-copy">
            Real-time SBAR handoff support for inpatient shift transitions with explicit disagreement handling and sentence-level provenance.
          </p>
        </div>

        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-footer">
          <div className="nav-footer-card">
            <p className="eyebrow-label">Guardrails</p>
            <div className="stacked-chips">
              <StatusChip label="Read only" tone="teal" compact />
              <StatusChip label="Human review required" tone="amber" compact />
              <StatusChip label="Conflict aware" tone="brick" compact />
            </div>
          </div>
          <div className="nav-footer-card">
            <p className="eyebrow-label">Data scope</p>
            <strong>Retrospective de-identified encounters</strong>
            <p>The local API simulates 24 to 72 hour inpatient handoff windows with structured labs, imaging, notes, and nursing assessments.</p>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow-label">Clinical handoff workspace</p>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          <div className="topbar-actions">
            <StatusChip label="Local API" tone="teal" />
            <StatusChip label="Ask Agent live" tone="paper" />
            <StatusChip label="SBAR + audit" tone="paper" />
            {topRight}
            <ThemeSwitcher />
          </div>
        </header>

        <section className="alert-strip" aria-label="Runtime handoff notices">
          {alertCards.map((alert, index) => (
            <article
              key={alert.id}
              className={`alert-card alert-card--${alert.tone}`}
              style={{ ["--i" as string]: index }}
            >
              <p className="eyebrow-label">{alert.timestamp}</p>
              <strong>{alert.title}</strong>
              <p>{alert.detail}</p>
            </article>
          ))}
        </section>

        <main className="page-body">{children}</main>
      </div>
    </div>
  );
}
