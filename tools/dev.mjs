// Runs the relay and the Vite dev server together; stops both when either stops.
import { spawn } from "node:child_process";

const children = [
  spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", "server/relay.ts"], { stdio: "inherit" }),
  spawn("pnpm", ["exec", "vite"], { stdio: "inherit" }),
];

const stop = () => children.forEach((c) => c.kill());
// The first child to stop decides the exit code; the others are then stopped.
let stopping = false;
for (const c of children) {
  c.on("exit", (code, signal) => {
    if (stopping) return;
    stopping = true;
    process.exitCode = code ?? (signal ? 1 : 0);
    stop();
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
