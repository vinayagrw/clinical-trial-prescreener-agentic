import { useEffect } from "react";
import { useImportedTrialsCatalogQuery } from "../data/queries/trialImports";
import { normalizeLocalApiError } from "../lib/localApiErrors";
import { useImportedTrialsStore } from "../stores/importedTrials";

export function ImportedTrialsBootstrap() {
  const { data, error, isLoading } = useImportedTrialsCatalogQuery();
  const hydrate = useImportedTrialsStore((state) => state.hydrate);
  const setLoading = useImportedTrialsStore((state) => state.setLoading);
  const setError = useImportedTrialsStore((state) => state.setError);

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
      setError(normalizeLocalApiError(error, "Unable to load imported trial catalog."));
    }
  }, [error, setError]);

  return null;
}
