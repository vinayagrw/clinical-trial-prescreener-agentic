import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { researchApi } from "../../lib/api";
import type {
  CreateInstitutionalProjectInput,
  CreateResearchProfileInput,
  GenerateDigestInput,
  UpdateResearchProfileInput,
} from "../../types";

export const researchQueryKeys = {
  profiles: ["research-profiles"] as const,
  profile: (profileId: string) => ["research-profile", profileId] as const,
  profileDigests: (profileId: string) => ["research-profile-digests", profileId] as const,
  digest: (digestId: string) => ["research-digest", digestId] as const,
  digestPublication: (digestId: string) => ["research-digest-publication", digestId] as const,
  publication: (publicationId: string) => ["research-publication", publicationId] as const,
};

export function useResearchProfilesQuery() {
  return useQuery({
    queryKey: researchQueryKeys.profiles,
    queryFn: () => researchApi.listProfiles(),
  });
}

export function useResearchProfileQuery(profileId: string | undefined) {
  return useQuery({
    queryKey: researchQueryKeys.profile(profileId ?? ""),
    enabled: Boolean(profileId),
    queryFn: () => researchApi.getProfile(profileId!),
  });
}

export function useResearchProfileDigestsQuery(profileId: string | undefined) {
  return useQuery({
    queryKey: researchQueryKeys.profileDigests(profileId ?? ""),
    enabled: Boolean(profileId),
    queryFn: () => researchApi.listDigests(profileId!),
  });
}

export function useResearchDigestQuery(digestId: string | undefined) {
  return useQuery({
    queryKey: researchQueryKeys.digest(digestId ?? ""),
    enabled: Boolean(digestId),
    queryFn: () => researchApi.getDigest(digestId!),
  });
}

export function useResearchDigestPublicationQuery(digestId: string | undefined) {
  return useQuery({
    queryKey: researchQueryKeys.digestPublication(digestId ?? ""),
    enabled: Boolean(digestId),
    queryFn: () => researchApi.getDigestPublication(digestId!),
  });
}

export function useCreateResearchProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateResearchProfileInput) => researchApi.createProfile(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profiles });
    },
  });
}

export function useUpdateResearchProfileMutation(profileId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateResearchProfileInput) => researchApi.updateProfile(profileId!, input),
    onSuccess: () => {
      if (profileId) {
        void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profile(profileId) });
        void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profiles });
      }
    },
  });
}

export function useCreateInstitutionalProjectMutation(profileId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInstitutionalProjectInput) => researchApi.addProject(profileId!, input),
    onSuccess: () => {
      if (profileId) {
        void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profile(profileId) });
      }
    },
  });
}

export function useResearchIngestMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId?: string) => researchApi.runIngest(profileId),
    onSuccess: (_result, profileId) => {
      void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profiles });
      if (profileId) {
        void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profile(profileId) });
      }
    },
  });
}

export function useResearchRecomputeMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profileId?: string) => researchApi.recompute(profileId),
    onSuccess: (_result, profileId) => {
      void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profiles });
      if (profileId) {
        void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profile(profileId) });
      }
    },
  });
}

export function useGenerateResearchDigestsMutation(profileId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateDigestInput) => researchApi.generateDigests(input),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profiles });
      if (profileId) {
        void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profile(profileId) });
        void queryClient.invalidateQueries({ queryKey: researchQueryKeys.profileDigests(profileId) });
      }
      for (const digest of result.digests) {
        void queryClient.invalidateQueries({ queryKey: researchQueryKeys.digest(digest.id) });
      }
    },
  });
}

export function useArchiveResearchDigestMutation(digestId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { runId: string; checkpointId: string; rationale: string; actorId?: string }) =>
      researchApi.archiveDigest(digestId!, input),
    onSuccess: () => {
      if (digestId) {
        void queryClient.invalidateQueries({ queryKey: researchQueryKeys.digest(digestId) });
        void queryClient.invalidateQueries({
          queryKey: researchQueryKeys.digestPublication(digestId),
        });
      }
    },
  });
}
