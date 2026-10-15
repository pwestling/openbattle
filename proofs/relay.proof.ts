import { test, expect, type Page } from "@playwright/test";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";

// The relay, driven from real browsers over its published protocol (design/surfaces/relay.html).

type Seen = { messages: unknown[]; closed: number | null; open: boolean };

/** Opens a raw socket to /signal from the page, under a name, recording what arrives. */
async function open(page: Page, name: string, game: string) {
  await page.evaluate(
    ([name, game]) =>
      new Promise<void>((resolve) => {
        const w = window as unknown as { sockets?: Record<string, { ws: WebSocket; seen: Seen }> };
        w.sockets ??= {};
        const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/signal?game=${encodeURIComponent(game!)}`);
        const seen: Seen = { messages: [], closed: null, open: false };
        w.sockets[name!] = { ws, seen };
        ws.onopen = () => ((seen.open = true), resolve());
        ws.onmessage = (e) => seen.messages.push(JSON.parse(e.data));
        ws.onclose = (e) => ((seen.closed = e.code), resolve());
      }),
    [name, game],
  );
}

const sendRaw = (page: Page, name: string, data: string) =>
  page.evaluate(([name, data]) => (window as any).sockets[name!].ws.send(data), [name, data]);
const send = (page: Page, name: string, message: unknown) => sendRaw(page, name, JSON.stringify(message));
const seen = (page: Page, name: string) => page.evaluate((name) => (window as any).sockets[name].seen as Seen, name);

test("browsers under one link meet, hand over handshake data, and are told who leaves", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto("/");
  await b.goto("/");
  const game = `meet-${Date.now()}`;

  await open(a, "a", game);
  await send(a, "a", { kind: "hello", browser: "alice" });
  await expect.poll(async () => (await seen(a, "a")).messages).toEqual([{ kind: "here", browsers: [] }]);

  await open(b, "b", game);
  await send(b, "b", { kind: "hello", browser: "bob" });
  await expect.poll(async () => (await seen(b, "b")).messages).toEqual([{ kind: "here", browsers: ["alice"] }]);
  await expect.poll(async () => (await seen(a, "a")).messages.at(-1)).toEqual({ kind: "arrived", browser: "bob" });

  // The relay names the sender itself; a browser cannot claim to be someone else.
  await send(b, "b", { kind: "signal", to: "alice", data: { offer: "sdp…", from: "mallory" } });
  await expect
    .poll(async () => (await seen(a, "a")).messages.at(-1))
    .toEqual({ kind: "signal", from: "bob", data: { offer: "sdp…", from: "mallory" } });

  // A browser under another link is out of reach.
  await open(b, "c", `${game}-other`);
  await send(b, "c", { kind: "hello", browser: "carol" });
  await expect.poll(async () => (await seen(b, "c")).messages).toEqual([{ kind: "here", browsers: [] }]);
  await send(b, "c", { kind: "signal", to: "alice", data: "hi" });

  await b.evaluate(() => (window as any).sockets.b.ws.close());
  await expect.poll(async () => (await seen(a, "a")).messages.at(-1)).toEqual({ kind: "left", browser: "bob" });
  // here, arrived, signal, left: carol's signal from the other link never reached alice.
  expect((await seen(a, "a")).messages).toHaveLength(4);
});

test("the relay forgets a link once everyone has gone", async ({ page }) => {
  await page.goto("/");
  const game = `forget-${Date.now()}`;
  await open(page, "first", game);
  await send(page, "first", { kind: "hello", browser: "alice" });
  await expect.poll(async () => (await seen(page, "first")).messages.length).toBe(1);
  await page.evaluate(() => (window as any).sockets.first.ws.close());
  await expect.poll(async () => (await seen(page, "first")).closed).not.toBeNull();

  await open(page, "again", game);
  await send(page, "again", { kind: "hello", browser: "bob" });
  await expect.poll(async () => (await seen(page, "again")).messages).toEqual([{ kind: "here", browsers: [] }]);
});

test("the same browser joining again replaces its earlier socket", async ({ page }) => {
  await page.goto("/");
  const game = `again-${Date.now()}`;
  await open(page, "watcher", game);
  await send(page, "watcher", { kind: "hello", browser: "watcher" });
  await open(page, "tab1", game);
  await send(page, "tab1", { kind: "hello", browser: "alice" });
  await open(page, "tab2", game);
  await send(page, "tab2", { kind: "hello", browser: "alice" });

  await expect.poll(async () => (await seen(page, "tab1")).closed).toBe(4001);
  await expect.poll(async () => (await seen(page, "tab2")).messages).toEqual([{ kind: "here", browsers: ["watcher"] }]);
  await expect
    .poll(async () => (await seen(page, "watcher")).messages)
    .toEqual([
      { kind: "here", browsers: [] },
      { kind: "arrived", browser: "alice" },
      { kind: "left", browser: "alice" },
      { kind: "arrived", browser: "alice" },
    ]);
});

test("the relay refuses bad links, messages outside the protocol, and anything over 64 KB", async ({ page }) => {
  await page.goto("/");

  await open(page, "badlink", "no spaces/or slashes");
  expect((await seen(page, "badlink")).open).toBe(false);

  await open(page, "nohello", `nohello-${Date.now()}`);
  await send(page, "nohello", { kind: "signal", to: "x", data: 1 });
  await expect.poll(async () => (await seen(page, "nohello")).closed).toBe(4000);

  const game = `big-${Date.now()}`;
  await open(page, "fits", game);
  await send(page, "fits", { kind: "hello", browser: "alice" });
  await sendRaw(page, "fits", JSON.stringify({ kind: "signal", to: "nobody", data: "x".repeat(60 * 1024) }));
  await open(page, "big", game);
  await send(page, "big", { kind: "hello", browser: "bob" });
  await sendRaw(page, "big", JSON.stringify({ kind: "signal", to: "alice", data: "x".repeat(64 * 1024) }));
  await expect.poll(async () => (await seen(page, "big")).closed).toBe(1009);
  expect((await seen(page, "fits")).closed).toBeNull();
});

test("health says signalling is up and TURN is not configured", async ({ page }) => {
  expect(await (await page.request.get("/health")).json()).toEqual({ signal: true, turn: false });
  expect((await page.request.get("/turn")).status()).toBe(503);
});

test("with a TURN secret, /turn hands out coturn credentials valid for 24 hours", async ({ page }) => {
  const port = 8797;
  const relay = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", "server/relay.ts"], {
    env: { ...process.env, RELAY_PORT: String(port), TURN_SECRET: "proof-secret", TURN_URLS: "turn:turn.example:3478, turns:turn.example:5349" },
  });
  try {
    await expect.poll(async () => (await page.request.get(`http://localhost:${port}/health`).catch(() => null))?.status()).toBe(200);
    expect(await (await page.request.get(`http://localhost:${port}/health`)).json()).toEqual({ signal: true, turn: true });

    const turn = await (await page.request.get(`http://localhost:${port}/turn`)).json();
    expect(turn.urls).toEqual(["turn:turn.example:3478", "turns:turn.example:5349"]);
    const expiry = Number(turn.username.split(":")[0]);
    expect(Math.abs(expiry - (Date.now() / 1000 + 24 * 60 * 60))).toBeLessThan(60);
    // coturn accepts the password it would compute itself from the shared secret.
    expect(turn.credential).toBe(createHmac("sha1", "proof-secret").update(turn.username).digest("base64"));
  } finally {
    relay.kill();
  }
});
