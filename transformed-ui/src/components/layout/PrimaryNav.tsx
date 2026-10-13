import React from "react";
import { NavLink, useLocation, useParams, matchPath } from "react-router-dom";

// Primary top-level navigation strip. Sits under the CommandBar and gives
// coordinators a visible link into every page in the app. Parameterized
// routes (review/audit/trials) default to the hero demo ids so the links
// always resolve, but when the user is already deep-linked into a specific
// match or trial we keep that id so "Audit" jumps to the audit for the
// patient they're currently reviewing.

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  /**
   * Items in the "workflow" group live in the patient-review flow; the "ops"
   * group is analytics. A divider is drawn between the two groups in the nav.
   */
  group: "workflow" | "ops";
}

const DEFAULT_MATCH_ID = "match-001";
const DEFAULT_TRIAL_ID = "trial-001";

function useActiveIds() {
  const location = useLocation();
  const params = useParams();

  // Pick up the current matchId if we're on /review/:matchId or /audit/:matchId
  const reviewMatch = matchPath("/review/:matchId", location.pathname);
  const auditMatch = matchPath("/audit/:matchId", location.pathname);
  const trialMatch = matchPath("/trials/:trialId", location.pathname);

  const matchId =
    params.matchId ||
    reviewMatch?.params.matchId ||
    auditMatch?.params.matchId ||
    DEFAULT_MATCH_ID;

  const trialId =
    params.trialId || trialMatch?.params.trialId || DEFAULT_TRIAL_ID;

  return { matchId, trialId };
}

export function PrimaryNav() {
  const { matchId, trialId } = useActiveIds();

  // Workflow group first, then the analytics (ops) group. A visual divider
  // separates the two in the rendered nav so Insights reads as a different
  // category than the patient-review workflow.
  const items: NavItem[] = [
    { to: "/mission-control", label: "Mission Control", group: "workflow" },
    { to: `/review/${matchId}`, label: "Deep Review", group: "workflow" },
    { to: `/audit/${matchId}`, label: "Audit Trace", group: "workflow" },
    { to: `/trials/${trialId}`, label: "Trial Config", group: "workflow" },
    { to: "/insights", label: "Insights", group: "ops" },
  ];

  return (
    <nav className="primary-nav" aria-label="Primary">
      <ul className="primary-nav__list">
        {items.map((item, idx) => {
          const prev = items[idx - 1];
          const needsDivider = prev && prev.group !== item.group;
          return (
            <React.Fragment key={item.label}>
              {needsDivider && (
                <li className="primary-nav__divider" aria-hidden="true" />
              )}
              <li>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    "primary-nav__item" +
                    (isActive ? " primary-nav__item--active" : "")
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </nav>
  );
}
