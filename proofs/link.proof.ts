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
  await expect.poll(() => connected(aliceAgain)).toEqual([b]);
  await expect.poll(() => connected(bob)).toEqual([a]);
  await send(bob, "which tab?");
  await expect.poll(() => received(aliceAgain)).toEqual([{ from: b, message: "which tab?" }]);
  expect(await received(alice)).toEqual([]);
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

test("connecting rejects when the relay cannot be reached", async ({ browser }) => {
  // The relay's socket is refused before the page loads.
  const alice = await player(browser, (page) => page.routeWebSocket(/\/signal/, (ws) => ws.close()));
  const outcome = await alice.evaluate((g) => (window as any).proof.connect(g).then(() => "connected", (e: Error) => e.message), game("down"));
  expect(outcome).toBe("The relay cannot be reached.");
});
