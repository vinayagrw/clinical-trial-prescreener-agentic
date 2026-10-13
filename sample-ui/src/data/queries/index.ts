/*
 * TanStack Query hooks wrapping mockApi.
 *
 * ## Why wrap synchronous mocks in Query?
 *
 * Two reasons.
 *
 * 1. **M5 swap cost is one line per query.** When we wire real HTTP, the
 *    `queryFn` body changes from `Promise.resolve(mockApi.getFoo())` to
 *    `fetch(...).then(r => r.json())`. Nothing outside this file moves.
 *
 * 2. **Loading / error / refetch become free.** Components consume
 *    `{ data, isLoading, error, refetch }` today against the mock. When
 *    the mock is replaced, all of those semantics keep working against
 *    real data — including optimistic updates and background refetch.
 *
 * Each hook shadows one function in mockApi.ts. Add a new hook here
 * whenever adding a new loader over there.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  getEnrollmentFunnel,
  getMatchReviewPackage,
  getOpsInsights,
  getPatientEvidenceBundle,
  getScreeningMetrics,
  getTrialMetric,
  listPatientMatches,
  parseTrialCriteria,
  screenPatient,
} from "../mockApi";
import type {
  MatchReviewPackage,
  PatientEvidenceBundle,
  ScreeningMetricSnapshot,
} from "../../types";

// --- Query key factory — colocated so it's hard to drift. ---

export const queryKeys = {
  screeningMetrics: ["screeningMetrics"] as const,
  enrollmentFunnel: ["enrollmentFunnel"] as const,
  opsInsights: ["opsInsights"] as const,
  matchReview: (matchId: string) => ["matchReview", matchId] as const,
  patientMatches: (patientId: string) => ["patientMatches", patientId] as const,
  patientEvidence: (patientId: string) => ["patientEvidence", patientId] as const,
  trialMetric: (trialId: string) => ["trialMetric", trialId] as const,
  trialCriteria: (trialId: string) => ["trialCriteria", trialId] as const,
  screeningJob: (patientId: string) => ["screeningJob", patientId] as const,
};

// --- Cockpit / queue ---

export function useScreeningMetricsQuery(
  options?: Omit<UseQueryOptions<ScreeningMetricSnapshot>, "queryKey" | "queryFn">,
) {
  return useQuery({
    queryKey: queryKeys.screeningMetrics,
    queryFn: () => getScreeningMetrics(),
    ...options,
  });
}

export function useEnrollmentFunnelQuery() {
  return useQuery({
    queryKey: queryKeys.enrollmentFunnel,
    queryFn: () => getEnrollmentFunnel(),
  });
}

export function useOpsInsightsQuery() {
  return useQuery({
    queryKey: queryKeys.opsInsights,
    queryFn: () => getOpsInsights(),
  });
}

// --- Review ---

export function useMatchReviewQuery(matchId: string | undefined) {
  return useQuery<MatchReviewPackage | null>({
    queryKey: queryKeys.matchReview(matchId ?? ""),
    enabled: Boolean(matchId),
    queryFn: () => (matchId ? getMatchReviewPackage(matchId) : null),
  });
}

// --- Patient-centric ---

export function usePatientMatchesQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patientMatches(patientId ?? ""),
    enabled: Boolean(patientId),
    queryFn: () => (patientId ? listPatientMatches(patientId) : null),
  });
}

export function usePatientEvidenceQuery(patientId: string | undefined) {
  return useQuery<PatientEvidenceBundle | null>({
    queryKey: queryKeys.patientEvidence(patientId ?? ""),
    enabled: Boolean(patientId),
    queryFn: () => (patientId ? getPatientEvidenceBundle(patientId) : null),
  });
}

export function useScreeningJobQuery(patientId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.screeningJob(patientId ?? ""),
    enabled: Boolean(patientId),
    queryFn: () => (patientId ? screenPatient(patientId) : null),
  });
}

// --- Trial / admin ---

export function useTrialMetricQuery(trialId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.trialMetric(trialId ?? ""),
    enabled: Boolean(trialId),
    queryFn: () => (trialId ? getTrialMetric(trialId) : null),
  });
}

export function useTrialCriteriaQuery(trialId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.trialCriteria(trialId ?? ""),
    enabled: Boolean(trialId),
    queryFn: () => (trialId ? parseTrialCriteria(trialId) : null),
  });
}
