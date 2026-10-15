import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const relay = `http://localhost:${process.env.RELAY_PORT ?? 8787}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT ?? 5173),
    strictPort: true,
    proxy: {
      "/signal": { target: relay, ws: true },
      "/turn": relay,
      "/health": relay,
    },
  },
});
