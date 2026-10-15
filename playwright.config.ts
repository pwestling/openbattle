import { defineConfig } from "@playwright/test";

// Proofs drive the real app in real browsers (ADR-018). The relay and the app run as in development.
export default defineConfig({
  testDir: "proofs",
  testMatch: "**/*.proof.ts",
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://localhost:5173" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
