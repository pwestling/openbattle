// Every call the screen makes into Session goes through here; Record, Measure and Archive have
// landed, so the screen calls them directly.
// While Session is still a stub ("session.… is not built yet"), each call falls back to a
// one-browser fake so the screen can be built and proven. Delete this file and src/screen/fake
// once Session lands.
import * as session from "../session/index.ts";
import type { Log } from "../record/index.ts";
import type { Me, Session } from "../session/index.ts";
import { fakeEnter, fakeOpen } from "./fake/session.ts";

/** Only Session's own stub: a stub further down (Link's, say) must not switch the screen to the fake. */
const notBuilt = (e: unknown) => e instanceof Error && e.message.startsWith("session.") && e.message.endsWith("is not built yet");

async function orFake<T>(real: () => Promise<T>, fake: () => T | Promise<T>): Promise<T> {
  try {
    return await real();
  } catch (e) {
    if (notBuilt(e)) return fake();
    throw e;
  }
}

export const openGame = (size: { width: number; depth: number }, me: Me): Promise<Session> =>
  orFake(
    () => session.open(size, me),
    () => fakeOpen(size, me),
  );

export const enterGame = (link: string, as: Me | "watch"): Promise<Session> =>
  orFake(
    () => session.enter(link, as),
    () => fakeEnter(link, as),
  );

/** Opens a saved game's log as a new game, with a fresh link and this browser as its host. */
export const openSaved = (log: Log, me: Me): Promise<Session> =>
  orFake(
    () => session.open(log.size, me, log),
    () => fakeOpen(log.size, me, log),
  );
