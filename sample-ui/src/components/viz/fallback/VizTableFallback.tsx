/*
 * VizTableFallback — the screen-reader + keyboard-only representation of every viz.
 *
 * Every viz that renders through VizFrame ships this table inside an sr-only
 * region so assistive tech gets the same data without the SVG. On viewports
 * below 480px, VizFrame promotes it to visible instead of rendering the viz —
 * this is the patient portal mobile story.
 *
 * The component is intentionally dumb: it takes a list of column descriptors
 * and a list of row records. The consumer is responsible for mapping domain
 * data to cell values.
 */

import type { ReactNode } from "react";

export interface VizTableColumn<T> {
  key: string;
  header: string;
  format?: (row: T, index: number) => ReactNode;
}

export interface VizTableFallbackProps<T> {
  caption: string;
  columns: VizTableColumn<T>[];
  rows: readonly T[];
  /** When true, render visibly (used by VizFrame at <480px). */
  visible?: boolean;
  id?: string;
}

export function VizTableFallback<T extends Record<string, unknown>>({
  caption,
  columns,
  rows,
  visible = false,
  id
}: VizTableFallbackProps<T>) {
  return (
    <table
      id={id}
      className={visible ? "viz-fallback-table viz-fallback-table--visible" : "viz-fallback-table"}
    >
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} scope="col">
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((col) => (
              <td key={col.key}>
                {col.format
                  ? col.format(row, rowIndex)
                  : String((row as Record<string, unknown>)[col.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
