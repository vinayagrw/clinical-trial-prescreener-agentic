import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { StatusChip } from "./StatusChip";
import { ThemeSwitcher } from "./shell/ThemeSwitcher";

interface ResearchShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  profileId?: string;
  digestId?: string;
  topRight?: ReactNode;
}

const alertCards = [
  {
    id: "research-live-ingest",
    tone: "action",
    timestamp: "Live sources",
    title: "PubMed + bioRxiv + medRxiv monitoring",
    detail: "This workspace is designed for live ingestion against external publication APIs backed by Postgres + pgvector.",
  },
  {
    id: "research-method-aware",
    tone: "info",
    timestamp: "Scoring",
    title: "Method-aware relevance",
    detail: "Ranking prioritizes extracted method similarity and cross-domain matches instead of simple keyword overlap alone.",
  },
  {
    id: "research-quality-signal",
    tone: "warning",
    timestamp: "Source quality",
    title: "Preprints stay labeled",
    detail: "Peer-reviewed and preprint sources remain visibly distinct throughout scoring, summaries, and digest review.",
  },
] as const;

export function ResearchShell({
  title,
  subtitle,
  children,
  profileId,
  digestId,
  topRight,
}: ResearchShellProps) {
  const navItems = [
    { to: "/cockpit", label: "Trial Workspace" },
    { to: "/handoffs", label: "Clinical Handoffs" },
    { to: "/ai-reviews", label: "AI Reviews" },
    { to: "/research-digests", label: "Digest Archive" },
    ...(profileId ? [{ to: `/research-digests/profiles/${profileId}`, label: "Profile" }] : []),
    ...(digestId ? [{ to: `/research-digests/digests/${digestId}`, label: "Digest" }] : []),
  ];

  return (
    <div className="app-shell">
      <aside className="app-nav">
        <div>
          <p className="nav-kicker">Faculty productivity pilot</p>
          <h1>Research Digest Studio</h1>
          <p className="nav-copy">
            Live literature monitoring for faculty and graduate labs with method-aware ranking, weekly digests, and explicit preprint quality signals.
          </p>
        </div>

        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? "nav-link--active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-footer">
          <div className="nav-footer-card">
            <p className="eyebrow-label">Delivery</p>
            <div className="stacked-chips">
              <StatusChip label="In-app weekly digests" tone="teal" compact />
              <StatusChip label="Method aware" tone="paper" compact />
              <StatusChip label="Traceable summaries" tone="paper" compact />
            </div>
          </div>
          <div className="nav-footer-card">
            <p className="eyebrow-label">Infra</p>
            <strong>Postgres + pgvector required</strong>
            <p>Research ingestion and digest persistence are intentionally separated from the handoff runtime store.</p>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow-label">Research monitoring workspace</p>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          <div className="topbar-actions">
            <StatusChip label="Live APIs" tone="teal" />
            <StatusChip label="Method scoring" tone="paper" />
            <StatusChip label="Ask Agent live" tone="paper" />
            {topRight}
            <ThemeSwitcher />
          </div>
        </header>

        <section className="alert-strip" aria-label="Research workspace notices">
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
