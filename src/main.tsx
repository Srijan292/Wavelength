import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "./styles/base.css";
import "./styles/auth.css";
import "./styles/library.css";
import "./styles/player.css";
import App from "./App";
import { applyTheme, loadThemeSettings } from "./lib/theme";

const saved = loadThemeSettings();
applyTheme(saved.theme, saved.accent);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
