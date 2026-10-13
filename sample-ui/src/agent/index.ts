/*
 * Agent layer barrel export.
 *
 * Consumers should prefer importing the pieces they actually need from the
 * specific files (better tree-shaking, faster editor navigation), but this
 * barrel exists so that a sweeping refactor can write
 * `import { mockAgentClient, resolveAgentScope, sessionBudget } from "../agent"`
 * without hand-tracking every file.
 */

export type { AgentClient, AgentRequest } from "./client";
export { withBudget } from "./client";

export { MockAgentClient, mockAgentClient } from "./mockClient";

export {
  isTextDelta,
  isToolCall,
  isToolResult,
  isComponentSpec,
  isCheckpointRequest,
  isRefusal,
  isError,
  isDone,
} from "./events";

export { resolveAgentScope, resolveScopeFromPath } from "./scope";
export type { RouteContext } from "./scope";

export {
  loadMemory,
  saveMemory,
  updateMemory,
  rememberOverride,
  shouldSurfaceInsight,
  dismissAmbientInsight,
  upsertSavedView,
  deleteSavedView,
} from "./memory";
export type { MemoryStore, SavedView, RememberedOverride } from "./memory";

export {
  createBudgetTracker,
  sessionBudget,
} from "./budget";
export type { BudgetState, BudgetTracker } from "./budget";

export {
  clientToolRegistry,
  registerTool,
  getTool,
  isToolAllowed,
  allowedRenderers,
  isRendererAllowed,
} from "./tools";
export type { ClientTool } from "./tools";
