import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import * as core from "./core";
import { loadSiteConfig, loadTurnLogins } from "./net/config";
import { useStore } from "./store";
import "./styles.css";

// The hosted site's TURN logins come from its login service, in the background.
loadTurnLogins();
// A self-hosted build reads its relay and TURN logins from the server first (src/net/config.ts).
void loadSiteConfig().then(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);

// The store and the core, in the console, for poking at.
Object.assign(window, { openBattle: useStore, openBattleCore: core });
