import { LOCAL_API_OFFLINE_MESSAGE, isLocalApiOfflineError } from "../lib/localApiErrors";
import { useImportedTrialsStore } from "../stores/importedTrials";
import { usePatientCatalogStore } from "../stores/patientCatalog";
import { StatusChip } from "./StatusChip";

export function LocalApiOfflineBanner() {
  const patientCatalogError = usePatientCatalogStore((state) => state.error);
  const importedTrialsError = useImportedTrialsStore((state) => state.error);
  const hasOfflineError =
    isLocalApiOfflineError(patientCatalogError) ||
    isLocalApiOfflineError(importedTrialsError);

  if (!hasOfflineError) {
    return null;
  }

  return (
    <div className="callout callout--warning app-dev-banner" role="status" aria-live="polite">
      <div className="app-dev-banner__top">
        <div>
          <p className="eyebrow-label">Local development</p>
          <strong>Backend services are offline</strong>
        </div>
        <StatusChip label="API unavailable" tone="amber" compact />
      </div>
      <p>{LOCAL_API_OFFLINE_MESSAGE}</p>
    </div>
  );
}
