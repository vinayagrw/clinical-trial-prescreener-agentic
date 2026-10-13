import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { KeyboardProvider } from "./context/KeyboardContext";
import App from "./App";

// Import styles in correct order
import "./styles/reset.css";
import "./styles/tokens.css";
import "./styles/typography.css";
import "./styles/animations.css";
import "./styles/glassmorphism.css";
import "./styles/dark-mode.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/pages.css";
import "./styles/responsive.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <KeyboardProvider>
          <App />
        </KeyboardProvider>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
