import React from "react";
import { Link } from "react-router-dom";

export interface PageCrosslink {
  label: string;
  to: string;
  /** If true, renders a left-pointing arrow instead of the default right. */
  back?: boolean;
}

interface PageCrosslinksProps {
  links: PageCrosslink[];
}

/**
 * Small context-aware navigation row under a page title. Renders
 * cross-links that relate this page to the rest of the patient-review
 * workflow (e.g. "View audit for this match" on Deep Review,
 * "Configure trial LU-021" on Audit Trace). These complement the primary
 * nav by naming the relationship between pages instead of forcing the user
 * to guess.
 */
export function PageCrosslinks({ links }: PageCrosslinksProps) {
  if (links.length === 0) return null;
  return (
    <nav className="page-crosslinks" aria-label="Related pages">
      {links.map((link) => (
        <Link key={link.to + link.label} to={link.to} className="page-crosslinks__chip">
          {link.back && <span className="page-crosslinks__chip-arrow" aria-hidden="true">←</span>}
          <span>{link.label}</span>
          {!link.back && <span className="page-crosslinks__chip-arrow" aria-hidden="true">→</span>}
        </Link>
      ))}
    </nav>
  );
}
