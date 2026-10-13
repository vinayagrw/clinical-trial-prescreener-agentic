import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { handoffApi } from "../../lib/api";
import type { WindowHours } from "../../types";

export const handoffQueryKeys = {
  worklist: ["handoff-worklist"] as const,
  handoff: (handoffId: string) => ["handoff-record", handoffId] as const,
  finalized: (handoffId: string) => ["handoff-finalized", handoffId] as const,
  audit: (handoffId: string) => ["handoff-audit", handoffId] as const,
  documents: (patientId: string, windowHours: WindowHours) =>
    ["handoff-documents", patientId, windowHours] as const,
};

export function useWorklistQuery(enabled = true) {
  return useQuery({
    queryKey: handoffQueryKeys.worklist,
    enabled,
    queryFn: () => handoffApi.getWorklist(),
  });
}

export function useHandoffQuery(handoffId: string | undefined) {
  return useQuery({
    queryKey: handoffQueryKeys.handoff(handoffId ?? ""),
    enabled: Boolean(handoffId),
    queryFn: () => handoffApi.getHandoff(handoffId!),
  });
}

export function useHandoffAuditQuery(handoffId: string | undefined) {
  return useQuery({
    queryKey: handoffQueryKeys.audit(handoffId ?? ""),
    enabled: Boolean(handoffId),
    queryFn: () => handoffApi.getAudit(handoffId!),
  });
}

export function useCommittedHandoffQuery(handoffId: string | undefined) {
  return useQuery({
    queryKey: handoffQueryKeys.finalized(handoffId ?? ""),
    enabled: Boolean(handoffId),
    queryFn: () => handoffApi.getFinalizedHandoff(handoffId!),
  });
}

export function usePatientDocumentsQuery(
  patientId: string | undefined,
  windowHours: WindowHours | undefined,
) {
  return useQuery({
    queryKey: handoffQueryKeys.documents(patientId ?? "", windowHours ?? 72),
    enabled: Boolean(patientId && windowHours),
    queryFn: () => handoffApi.getPatientDocuments(patientId!, windowHours!),
  });
}

export function useGenerateHandoffMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: handoffApi.generateHandoff,
    onSuccess: (record) => {
      queryClient.setQueryData(handoffQueryKeys.handoff(record.id), record);
      void queryClient.invalidateQueries({ queryKey: handoffQueryKeys.worklist });
      void queryClient.invalidateQueries({
        queryKey: handoffQueryKeys.documents(record.patientId, record.windowHours),
      });
      void queryClient.invalidateQueries({
        queryKey: handoffQueryKeys.audit(record.id),
      });
    },
  });
}

export function useReindexDocumentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => handoffApi.reindexDocuments(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: handoffQueryKeys.worklist });
    },
  });
}
