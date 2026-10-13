import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientCatalogApi } from "../../lib/api";
import { usePatientCatalogStore } from "../../stores/patientCatalog";

export const patientCatalogQueryKeys = {
  catalog: ["patient-catalog"] as const,
};

export function usePatientCatalogQuery() {
  return useQuery({
    queryKey: patientCatalogQueryKeys.catalog,
    queryFn: () => patientCatalogApi.listPatientCatalog(),
  });
}

export function useUploadPatientRecordMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { fileName: string; rawRecordText: string }) =>
      patientCatalogApi.uploadPatientRecord(input),
    onSuccess: (item) => {
      usePatientCatalogStore.getState().upsert(item);
      void queryClient.invalidateQueries({
        queryKey: patientCatalogQueryKeys.catalog,
      });
    },
  });
}

export function useDeleteUploadedPatientMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patientId: string) =>
      patientCatalogApi.deletePatient(patientId),
    onSuccess: (result) => {
      usePatientCatalogStore.getState().remove(result);
      void queryClient.invalidateQueries({
        queryKey: patientCatalogQueryKeys.catalog,
      });
    },
  });
}
