// Runs the relay and the Vite dev server together; stops both when either stops.
import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", "server/relay.ts"], { stdio: "inherit" }),
  spawn("pnpm", ["exec", "vite"], { stdio: "inherit" }),
];

const stop = () => children.forEach((c) => c.kill());
for (const c of children) c.on("exit", (code) => { stop(); process.exitCode = code ?? 0; });
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
