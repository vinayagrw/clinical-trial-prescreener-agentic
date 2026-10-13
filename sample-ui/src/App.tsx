/*
 * App.tsx - route tree + global shell hosts.
 *
 * The app exposes both workspaces side by side:
 * - the legacy trial eligibility pre-screener workflow
 * - the SBAR handoff workspace under /handoffs
 *
 * `/` intentionally lands on `/cockpit` so the original coordinator-first
 * trial workspace remains the primary home page.
 */

import { Navigate, Route, Routes } from "react-router-dom";
import { GlobalAskWidget } from "./components/GlobalAskWidget";
import { ImportedTrialsBootstrap } from "./components/ImportedTrialsBootstrap";
import { InstitutionalTrialsBootstrap } from "./components/InstitutionalTrialsBootstrap";
import { PatientCatalogBootstrap } from "./components/PatientCatalogBootstrap";
import { TooltipProvider } from "./components/primitives";
import { ToastHost } from "./components/shell/ToastHost";
import { AiFeaturesPage } from "./pages/AiFeaturesPage";
import { AiReviewQueuePage } from "./pages/AiReviewQueuePage";
import { AuditPage } from "./pages/AuditPage";
import { CockpitPage } from "./pages/CockpitPage";
import { CommandCenterPage } from "./pages/CommandCenterPage";
import { HandoffAuditPage } from "./pages/HandoffAuditPage";
import { HandoffCasePage } from "./pages/HandoffCasePage";
import { HandoffWorklistPage } from "./pages/HandoffWorklistPage";
import { ReviewWorkbenchPage } from "./pages/ReviewWorkbenchPage";
import { ResearchDigestArchivePage } from "./pages/ResearchDigestArchivePage";
import { ResearchDigestPage } from "./pages/ResearchDigestPage";
import { ResearchProfilePage } from "./pages/ResearchProfilePage";
import { SafetyDashboardPage } from "./pages/SafetyDashboardPage";
import { ScreeningPage } from "./pages/ScreeningPage";
import { TrialAdminPage } from "./pages/TrialAdminPage";
import { useAiProvidersSync } from "./stores/aiProviders";

export default function App() {
  useAiProvidersSync();

  return (
    <TooltipProvider delayDuration={250}>
      <PatientCatalogBootstrap />
      <ImportedTrialsBootstrap />
      <InstitutionalTrialsBootstrap />
      <Routes>
        <Route path="/" element={<Navigate to="/cockpit" replace />} />
        <Route path="/cockpit" element={<CockpitPage />} />
        <Route path="/review/:matchId" element={<ReviewWorkbenchPage />} />
        <Route path="/command-center" element={<CommandCenterPage />} />
        <Route path="/admin/trials/:trialId" element={<TrialAdminPage />} />
        <Route path="/audit/:matchId" element={<AuditPage />} />
        <Route path="/ai-features" element={<AiFeaturesPage />} />
        <Route path="/ai-reviews" element={<AiReviewQueuePage />} />
        <Route path="/screening" element={<ScreeningPage />} />
        <Route path="/safety" element={<SafetyDashboardPage />} />
        <Route path="/handoffs" element={<HandoffWorklistPage />} />
        <Route path="/handoffs/:handoffId" element={<HandoffCasePage />} />
        <Route path="/handoffs/:handoffId/audit" element={<HandoffAuditPage />} />
        <Route path="/research-digests" element={<ResearchDigestArchivePage />} />
        <Route path="/research-digests/profiles/:profileId" element={<ResearchProfilePage />} />
        <Route path="/research-digests/digests/:digestId" element={<ResearchDigestPage />} />
      </Routes>
      <GlobalAskWidget />
      <ToastHost />
    </TooltipProvider>
  );
}
