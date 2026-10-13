import { useEffect } from "react";
import { useInstitutionalTrialsCatalogQuery } from "../data/queries/institutionalTrials";
import { normalizeLocalApiError } from "../lib/localApiErrors";
import { useInstitutionalTrialsStore } from "../stores/institutionalTrials";

export function InstitutionalTrialsBootstrap() {
  const { data, error, isLoading } = useInstitutionalTrialsCatalogQuery();
  const hydrate = useInstitutionalTrialsStore((state) => state.hydrate);
  const setLoading = useInstitutionalTrialsStore((state) => state.setLoading);
  const setError = useInstitutionalTrialsStore((state) => state.setError);

  useEffect(() => {
    if (isLoading) {
      setLoading();
    }
  }, [isLoading, setLoading]);

  useEffect(() => {
    if (data) {
      hydrate(data);
    }
  }, [data, hydrate]);

  useEffect(() => {
    if (error instanceof Error) {
      setError(
        normalizeLocalApiError(error, "Unable to load institutional trial catalog."),
      );
    }
  }, [error, setError]);

  return null;
}
