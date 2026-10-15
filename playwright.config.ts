import { defineConfig } from "@playwright/test";

// Proofs drive the real app in real browsers (ADR-018). The relay and the app run as in development.
// Set REUSE_SERVER=1 to run against a dev server you already started.
export default defineConfig({
  testDir: "proofs",
  testMatch: "**/*.proof.ts",
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://localhost:5173" },
  webServer: {
    command: "pnpm dev",
    // Through Vite's proxy, so the wait ends only when both the app and the relay answer.
    url: "http://localhost:5173/health",
    reuseExistingServer: process.env.REUSE_SERVER === "1",
  },
});
