import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { alerts } from "../data/mockData";
import { LocalApiOfflineBanner } from "./LocalApiOfflineBanner";
import { StatusChip } from "./StatusChip";
import { ThemeSwitcher } from "./shell/ThemeSwitcher";
import { useUiStore } from "../stores/ui";

interface AppShellProps {
  title: string;
  subtitle: string;
  /**
   * Wave D.1 — when true the alert strip renders in its dense 4-column
   * chip layout (reduced padding + hidden detail copy). Opt-in per page
   * so prose-heavy routes can keep the full 2-col alert-card treatment.
   * Defaults to false.
   */
  compactAlerts?: boolean;
  children: ReactNode;
}

const navItems = [
  { to: "/cockpit", label: "Cockpit" },
  { to: "/review/match-001", label: "Review Workbench" },
  { to: "/command-center", label: "Command Center" },
  { to: "/admin/trials/trial-001", label: "Trial Admin" },
  { to: "/audit/match-001", label: "Audit View" },
  { to: "/ai-features", label: "AI Features" },
  { to: "/ai-reviews", label: "AI Reviews" },
  { to: "/screening", label: "Live Screening" },
  { to: "/safety", label: "Patient Safety" },
  { to: "/handoffs", label: "Clinical Handoffs" },
  { to: "/research-digests", label: "Research Digests" }
];

export function AppShell({
  title,
  subtitle,
  compactAlerts = false,
  children
}: AppShellProps) {
  // Subscribe so the shell re-renders when the theme cycles, keeping the ThemeSwitcher glyph in sync.
  useUiStore((s) => s.theme);
  return (
    <div className="app-shell">
      <aside className="app-nav">
        <div>
          <p className="nav-kicker">CTP Clinical Trial Pre-Screener pilot</p>
          <h1>Trial Eligibility Pre-Screener</h1>
          <p className="nav-copy">
            Coordinator-first review for hybrid, evidence-backed oncology screening with pilot-core and wow-demo lanes.
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
            <p className="eyebrow-label">Pilot guardrails</p>
            <div className="stacked-chips">
              <StatusChip label="Coordinator-first" tone="teal" compact />
              <StatusChip label="Human review required" tone="amber" compact />
              <StatusChip label="No Epic write-back" tone="paper" compact />
            </div>
          </div>
          <div className="nav-footer-card">
            <p className="eyebrow-label">Workspace scope</p>
            <strong>Thoracic oncology pilot queue</strong>
            <p>This workspace covers the thoracic screening queue for 10-20 locally active trials.</p>
            <div className="stacked-chips nav-footer-chips">
              <StatusChip label="Nightly re-screening" tone="paper" compact />
              <StatusChip label="Audit replay" tone="paper" compact />
              <StatusChip label="PI escalation in workflow" tone="paper" compact />
            </div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        {/* Wave D.1 — 2-row topbar. Row 1 packs eyebrow + title on the left
           with search + status chips + theme switcher on the right; row 2
           carries the subtitle at text-small so the header collapses from
           ~80–100px to ~60px without losing page context. */}
        <header className="topbar">
          <div className="topbar__row topbar__row--primary">
            <div className="topbar__title">
              <p className="eyebrow-label">Sample workflow</p>
              <h2>{title}</h2>
            </div>

            <div className="topbar-actions">
              <input
                className="topbar-search"
                placeholder="Search patient, trial, biomarker, or criterion"
                aria-label="Global search"
              />
              <StatusChip label="Ask Agent live" tone="teal" />
              <StatusChip label="Mock data" tone="paper" />
              <ThemeSwitcher />
            </div>
          </div>
          <p className="topbar__subtitle">{subtitle}</p>
        </header>

        <LocalApiOfflineBanner />

        <section
          className={`alert-strip ${compactAlerts ? "alert-strip--compact" : ""}`.trim()}
          aria-label="Continuous tracking notifications"
        >
          {alerts.map((alert, index) => (
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
