import React from "react";
import { Link, useLocation } from "react-router-dom";
import { patients, trials, queueItems } from "../../data/index";

export function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // Breadcrumbs is rendered inside CommandBar at the AppFrame level, which
  // sits OUTSIDE the Route tree — so useParams() returns an empty object
  // here. We parse the id off the URL segments directly instead. This
  // previously caused every crumb trail to collapse to just "Mission
  // Control" for every deep page.
  const routeKey = segments[0];
  const idSegment = segments[1];

  const crumbs: { label: string; to?: string }[] = [
    { label: "Mission Control", to: "/mission-control" },
  ];

  if (routeKey === "review" && idSegment) {
    const queueItem = queueItems.find((q) => q.matchId === idSegment);
    const patient = queueItem
      ? patients.find((p) => p.id === queueItem.patientId)
      : undefined;
    const trial = queueItem
      ? trials.find((t) => t.id === queueItem.trialId)
      : undefined;

    if (patient) {
      crumbs.push({ label: patient.name });
    }
    if (trial) {
      crumbs.push({ label: trial.shortCode });
    }
  } else if (routeKey === "audit" && idSegment) {
    const queueItem = queueItems.find((q) => q.matchId === idSegment);
    const patient = queueItem
      ? patients.find((p) => p.id === queueItem.patientId)
      : undefined;
    const trial = queueItem
      ? trials.find((t) => t.id === queueItem.trialId)
      : undefined;

    if (patient) {
      crumbs.push({ label: patient.name });
    }
    if (trial) {
      crumbs.push({ label: trial.shortCode });
    }
    crumbs.push({ label: "Audit Trace" });
  } else if (routeKey === "insights") {
    crumbs.push({ label: "Insights" });
  } else if (routeKey === "trials" && idSegment) {
    const trial = trials.find((t) => t.id === idSegment);
    crumbs.push({ label: trial ? trial.shortCode : idSegment });
    crumbs.push({ label: "Configuration" });
  }

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="breadcrumbs__separator" aria-hidden="true">
                /
              </span>
            )}
            {isLast || !crumb.to ? (
              <span
                className={`breadcrumbs__item ${
                  isLast ? "breadcrumbs__item--active" : ""
                }`}
                aria-current={isLast ? "page" : undefined}
              >
                {crumb.label}
              </span>
            ) : (
              <Link className="breadcrumbs__item" to={crumb.to}>
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
