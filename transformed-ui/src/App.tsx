import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppFrame } from "./components/layout/AppFrame";

const MissionControlPage = lazy(() => import("./pages/MissionControlPage"));
const DeepReviewPage = lazy(() => import("./pages/DeepReviewPage"));
const InsightsPage = lazy(() => import("./pages/InsightsPage"));
const TrialConfigPage = lazy(() => import("./pages/TrialConfigPage"));
const AuditTracePage = lazy(() => import("./pages/AuditTracePage"));

function PageLoader() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div className="skeleton skeleton--text" style={{ width: 200 }} />
    </div>
  );
}

export default function App() {
  return (
    <AppFrame>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/mission-control" replace />} />
          <Route path="/mission-control" element={<MissionControlPage />} />
          <Route path="/review/:matchId" element={<DeepReviewPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/trials/:trialId" element={<TrialConfigPage />} />
          <Route path="/audit/:matchId" element={<AuditTracePage />} />
        </Routes>
      </Suspense>
    </AppFrame>
  );
}
