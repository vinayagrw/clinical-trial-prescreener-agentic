import type { ReviewAction } from "../../types";

const STORAGE_KEY = "ctp-prescreener-review-actions";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readActions(): ReviewAction[] {
  if (!canUseStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as ReviewAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeActions(actions: ReviewAction[]) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
}

export function listPersistedReviewActions(matchId?: string) {
  const actions = readActions();
  return matchId ? actions.filter((action) => action.matchId === matchId) : actions;
}

export function persistReviewAction(action: ReviewAction) {
  const actions = readActions();
  const nextActions = [...actions, action];
  writeActions(nextActions);
  return action;
}

export function getLatestReviewAction(
  matchId: string,
  actionType: ReviewAction["actionType"],
  criterionId?: string
) {
  const actions = listPersistedReviewActions(matchId).filter((action) => {
    if (action.actionType !== actionType) {
      return false;
    }

    if (criterionId) {
      return action.criterionId === criterionId;
    }

    return true;
  });

  return actions.at(-1);
}
