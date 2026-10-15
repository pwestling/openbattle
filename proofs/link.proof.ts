import { test, expect, type Browser, type Page } from "@playwright/test";

// The link, driven from real browsers through a local relay (design/surfaces/link.html).
// Each player is its own browser context, as a separate person on a separate machine would be.

type Received = { from: string; message: unknown };

async function player(browser: Browser, before?: (page: Page) => Promise<void>): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await before?.(page);
  await page.goto("/proofs/link.html");
  await page.waitForFunction(() => "proof" in window);
  return page;
}

const join = (page: Page, game: string) => page.evaluate((game) => (window as any).proof.connect(game) as Promise<string>, game);
const send = (page: Page, message: unknown, to?: string) => page.evaluate(([m, to]) => (window as any).proof.link.send(m, to), [message, to] as const);
const received = (page: Page) => page.evaluate(() => (window as any).proof.received as Received[]);
const connected = (page: Page) => page.evaluate(() => (window as any).proof.connected() as string[]);
const game = (name: string) => `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

test("two browsers in one game connect and exchange messages both ways", async ({ browser }) => {
  const g = game("pair");
  const alice = await player(browser);
  const bob = await player(browser);
  const a = await join(alice, g);
  const b = await join(bob, g);
  expect(a).not.toBe(b);

  await expect.poll(() => connected(alice)).toEqual([b]);
  await expect.poll(() => connected(bob)).toEqual([a]);

  await send(alice, { hello: "from alice", n: [1, 2, 3], nested: { ok: true, none: null } });
  await send(bob, "from bob", a);
  await expect.poll(() => received(bob)).toEqual([{ from: a, message: { hello: "from alice", n: [1, 2, 3], nested: { ok: true, none: null } } }]);
  await expect.poll(() => received(alice)).toEqual([{ from: b, message: "from bob" }]);
});

test("messages arrive whole and in the order they were sent, however large", async ({ browser }) => {
  const g = game("order");
  const alice = await player(browser);
  const bob = await player(browser);
  await join(alice, g);
  const b = await join(bob, g);
  await expect.poll(() => connected(alice)).toEqual([b]);

  // 300 messages, with a 40 MB one and a few 1 MB ones among small ones, sent in one go.
  const sizes = await alice.evaluate(() => {
    const sizes: number[] = [];
    for (let i = 0; i < 300; i++) {
      const size = i === 150 ? 40_000_000 : i % 50 === 7 ? 1_000_000 : i % 13;
      sizes.push(size);
      (window as any).proof.link.send({ i, body: String.fromCharCode(97 + (i % 26)).repeat(size), text: "é✓🎲" });
    }
    return sizes;
  });

  await expect.poll(() => bob.evaluate(() => (window as any).proof.received.length), { timeout: 60_000 }).toBe(300);
  const seen = await bob.evaluate(() =>
    (window as any).proof.received.map(({ message: m }: any) => ({
      i: m.i,
      size: m.body.length,
      same: m.body === String.fromCharCode(97 + (m.i % 26)).repeat(m.body.length),
      text: m.text,
    })),
  );
  expect(seen).toEqual(sizes.map((size, i) => ({ i, size, same: true, text: "é✓🎲" })));
});

test("a message to one browser reaches only that browser", async ({ browser }) => {
  const g = game("three");
  const [alice, bob, carol] = [await player(browser), await player(browser), await player(browser)];
  const a = await join(alice, g);
  const b = await join(bob, g);
  const c = await join(carol, g);
  await expect.poll(() => connected(alice)).toEqual([b, c].sort());
  await expect.poll(() => connected(bob)).toEqual([a, c].sort());
  await expect.poll(() => connected(carol)).toEqual([a, b].sort());

  await send(alice, "just for carol", c);
  await send(alice, "for everyone");
  await expect.poll(() => received(carol)).toEqual([
    { from: a, message: "just for carol" },
    { from: a, message: "for everyone" },
  ]);
  await expect.poll(() => received(bob)).toEqual([{ from: a, message: "for everyone" }]);
});

test("a browser keeps its id across visits, and comes back into the game after reloading", async ({ browser }) => {
  const g = game("return");
  const alice = await player(browser);
  const bob = await player(browser);
  const a = await join(alice, g);
  const b = await join(bob, g);
  await expect.poll(() => connected(bob)).toEqual([a]);

  await alice.reload();
  await alice.waitForFunction(() => "proof" in window);
  expect(await join(alice, g)).toBe(a);

  await expect.poll(() => connected(alice)).toEqual([b]);
  await expect.poll(() => connected(bob)).toEqual([a]);
  await send(bob, "welcome back");
  await expect.poll(() => received(alice)).toEqual([{ from: b, message: "welcome back" }]);
});

test("opening the game in a second tab moves this browser to the new tab", async ({ browser }) => {
  const g = game("tabs");
  const alice = await player(browser);
  const bob = await player(browser);
  const a = await join(alice, g);
  const b = await join(bob, g);
  await expect.poll(() => connected(bob)).toEqual([a]);

  // Same browser, so same id: the newest tab is this browser and the first tab's link closes.
  const aliceAgain = await alice.context().newPage();
  await aliceAgain.goto("/proofs/link.html");
  await aliceAgain.waitForFunction(() => "proof" in window);
  expect(await join(aliceAgain, g)).toBe(a);

  await expect.poll(() => connected(alice)).toEqual([]);
  expect(await alice.evaluate(() => (window as any).proof.link.replaced)).toBe(true);
  expect(await aliceAgain.evaluate(() => (window as any).proof.link.replaced)).toBe(false);
  await expect.poll(() => connected(aliceAgain)).toEqual([b]);
  // Bob saw alice leave and come back, so it knows to catch the new tab up.
  await expect.poll(() => bob.evaluate(() => (window as any).proof.changes.slice(-2))).toEqual([[], [a]]);
  await expect.poll(() => connected(bob)).toEqual([a]);
  await send(bob, "which tab?");
  await expect.poll(() => received(aliceAgain)).toEqual([{ from: b, message: "which tab?" }]);
  expect(await received(alice)).toEqual([]);
});

test("losing the relay for a moment loses no messages and drops no connection", async ({ browser }) => {
  const g = game("blip");
  // Alice's relay socket runs through a route the proof can cut, as a network blip or relay restart would.
  const cuts: (() => void)[] = [];
  const alice = await player(browser, (page) =>
    page.routeWebSocket(/\/signal/, (ws) => {
      const server = ws.connectToServer();
      cuts.push(() => (ws.close(), server.close()));
    }),
  );
  const bob = await player(browser);
  const a = await join(alice, g);
  const b = await join(bob, g);
  await expect.poll(() => connected(bob)).toEqual([a]);
  const changesBefore = await bob.evaluate(() => (window as any).proof.changes.length);

  // Alice streams numbered messages while her relay socket is cut and comes back.
  const streaming = alice.evaluate(async () => {
    for (let i = 0; i < 400; i++) {
      (window as any).proof.link.send({ i, body: "x".repeat(i % 5 === 0 ? 300_000 : 10) });
      await new Promise((r) => setTimeout(r, 10));
    }
  });
  await alice.waitForTimeout(500);
  cuts[0]!();
  await expect.poll(() => cuts.length, { timeout: 15_000 }).toBe(2);
  await streaming;

  await expect.poll(() => bob.evaluate(() => (window as any).proof.received.length), { timeout: 30_000 }).toBe(400);
  expect(await bob.evaluate(() => (window as any).proof.received.map((r: any) => r.message.i))).toEqual([...Array(400).keys()]);
  // Give a late reconnect handshake time to finish, then check nobody saw alice leave.
  await bob.waitForTimeout(2000);
  expect(await bob.evaluate((n) => (window as any).proof.changes.slice(n), changesBefore)).toEqual([]);
  expect(await connected(alice)).toEqual([b]);
});

test("closing a link disconnects it from everyone, and the relay forgets it", async ({ browser }) => {
  const g = game("close");
  const alice = await player(browser);
  const bob = await player(browser);
  const a = await join(alice, g);
  const b = await join(bob, g);
  await expect.poll(() => connected(bob)).toEqual([a]);

  await alice.evaluate(() => (window as any).proof.link.close());
  await expect.poll(() => connected(alice)).toEqual([]);
  await expect.poll(() => connected(bob)).toEqual([]);

  // Messages to a browser that is not connected are dropped.
  await send(bob, "anyone there?", a);
  await send(bob, "anyone at all?");

  const carol = await player(browser);
  await join(carol, g);
  await expect.poll(() => connected(carol)).toEqual([b]);
  expect(await received(alice)).toEqual([]);
});

test("a browser claiming another's id is refused, and the real one stays connected", async ({ browser }) => {
  const g = game("spoof");
  const host = await player(browser);
  const bob = await player(browser);
  const h = await join(host, g);
  const b = await join(bob, g);
  await expect.poll(() => connected(bob)).toEqual([h]);
  const hostKey = await host.evaluate(() => (window as any).proof.link.publicKey as string);

  // A modified client: it shows the host's public key, so it claims the host's id, but it can only sign with its own key.
  const mallory = await player(browser, (page) =>
    page.addInitScript((key) => {
      const real = crypto.subtle.exportKey.bind(crypto.subtle);
      crypto.subtle.exportKey = (async (format: string, k: CryptoKey) => {
        if (format !== "raw") return real(format as any, k);
        const plain = atob(key.replaceAll("-", "+").replaceAll("_", "/"));
        return Uint8Array.from(plain, (c) => c.charCodeAt(0)).buffer;
      }) as typeof crypto.subtle.exportKey;
    }, hostKey),
  );
  // The relay asks it to sign for that id as it joins, and it can't.
  const outcome = await mallory.evaluate((g) => (window as any).proof.connect(g).then(() => "joined", (e: Error) => e.message), g);
  expect(outcome).toBe("The relay refused this browser's proof of id.");

  // The host keeps its place: its connection to bob stays, and a newcomer still reaches it.
  const carol = await player(browser);
  const c = await join(carol, g);
  await expect.poll(() => connected(carol)).toEqual([b, h].sort());
  expect(await connected(bob)).toEqual([c, h].sort());
  await send(host, "still me");
  await expect.poll(() => received(bob)).toEqual([{ from: h, message: "still me" }]);
  await expect.poll(() => received(carol)).toEqual([{ from: h, message: "still me" }]);
});

test("a browser signs for others, and anyone can check it against its public key and id", async ({ browser }) => {
  const g = game("sign");
  const alice = await player(browser);
  const bob = await player(browser);
  const a = await join(alice, g);
  await join(bob, g);
  const key = await alice.evaluate(() => (window as any).proof.link.publicKey as string);
  const signature = await alice.evaluate(() => (window as any).proof.sign("seal:1f2e value:42"));

  // Bob checks it with nothing but the public key, as a spectator or a saved file would.
  expect(await bob.evaluate((key) => (window as any).proof.idFor(key), key)).toBe(a);
  const check = (text: string, sig: string, k = key) => bob.evaluate(([k, t, s]) => (window as any).proof.verify(k, t, s), [k, text, sig]);
  expect(await check("seal:1f2e value:42", signature)).toBe(true);
  expect(await check("seal:1f2e value:43", signature)).toBe(false);
  expect(await check("seal:1f2e value:42", signature, await bob.evaluate(() => (window as any).proof.link.publicKey))).toBe(false);
  expect(await check("seal:1f2e value:42", "not a signature")).toBe(false);
  expect(await bob.evaluate(() => (window as any).proof.idFor("bm90IGEga2V5").then(() => "accepted", () => "rejected"))).toBe("rejected");
});

test("a browser's id is worked out from its public key, and known before joining a game", async ({ browser }) => {
  const alice = await player(browser);
  const before = await alice.evaluate(() => (window as any).proof.thisBrowser());
  const a = await join(alice, game("id"));
  expect(before).toEqual({ id: a, publicKey: await alice.evaluate(() => (window as any).proof.link.publicKey) });
  const key = await alice.evaluate(() => (window as any).proof.link.publicKey as string);
  // base64url of the first 16 bytes of SHA-256 of the raw public key (ADR-022), computed here outside the browser.
  const { createHash } = await import("node:crypto");
  expect(a).toBe(createHash("sha256").update(Buffer.from(key, "base64url")).digest().subarray(0, 16).toString("base64url"));
});

test("connecting rejects when the relay cannot be reached", async ({ browser }) => {
  // The relay's socket is refused before the page loads.
  const alice = await player(browser, (page) => page.routeWebSocket(/\/signal/, (ws) => ws.close()));
  const outcome = await alice.evaluate((g) => (window as any).proof.connect(g).then(() => "connected", (e: Error) => e.message), game("down"));
  expect(outcome).toBe("The relay cannot be reached.");
});
