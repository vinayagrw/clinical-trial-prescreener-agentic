/*
 * Barrel export for the viz layer.
 * Composed viz import from here; primitives remain accessible via deep paths
 * when they need axes/tooltips that live under src/components/viz/axes/ or tooltips/.
 */

export { VizFrame } from "./VizFrame";
export type { VizFrameProps } from "./VizFrame";

export { useVizPalette } from "./useVizPalette";
export type { VizPalette } from "./useVizPalette";

export { useVizSize } from "./useVizSize";
export type { VizSize } from "./useVizSize";

export { useVizKeyboardNav } from "./useVizKeyboardNav";
export type {
  VizKeyboardNavOptions,
  VizKeyboardNavResult
} from "./useVizKeyboardNav";

export { VizTableFallback } from "./fallback/VizTableFallback";
export type {
  VizTableFallbackProps,
  VizTableColumn
} from "./fallback/VizTableFallback";

export { Sparkline } from "./primitives/Sparkline";
export type { SparklineProps } from "./primitives/Sparkline";

export { FunnelBar } from "./primitives/FunnelBar";
export type { FunnelBarProps, FunnelBarDatum } from "./primitives/FunnelBar";

export { Heatmap } from "./primitives/Heatmap";
export type { HeatmapProps, HeatmapCell } from "./primitives/Heatmap";

export { DotMatrix } from "./primitives/DotMatrix";
export type { DotMatrixProps, DotMatrixDatum } from "./primitives/DotMatrix";

export { SlopeChart } from "./primitives/SlopeChart";
export type { SlopeChartProps, SlopeDatum } from "./primitives/SlopeChart";

export { ParallelCoordinates } from "./primitives/ParallelCoordinates";
export type {
  ParallelCoordinatesProps,
  ParallelDimension,
  ParallelRecord
} from "./primitives/ParallelCoordinates";

export { TemporalStrip } from "./primitives/TemporalStrip";
export type {
  TemporalStripProps,
  TemporalEvent,
  TemporalWindow,
  TemporalTone,
  TemporalWindowTone
} from "./primitives/TemporalStrip";

export { SwimLane } from "./primitives/SwimLane";
export type {
  SwimLaneProps,
  SwimLaneEvent,
  SwimLaneTone
} from "./primitives/SwimLane";

export { ArcDiagram } from "./primitives/ArcDiagram";
export type {
  ArcDiagramProps,
  ArcAnchor,
  ArcAnchorMap,
  ArcEdge
} from "./primitives/ArcDiagram";
