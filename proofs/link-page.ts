// A page that holds one link and records what it sees, for proofs/link.proof.ts to drive.
// It uses only the link module's public face.
import { connect, idFor, thisBrowser, verify, type BrowserId, type Json, type Link } from "../src/link/index.ts";

type Received = { from: BrowserId; message: Json };

const page = {
  link: null as Link | null,
  received: [] as Received[],
  changes: [] as BrowserId[][],

  async connect(game: string): Promise<BrowserId> {
    const link = await connect(game);
    page.link = link;
    link.onMessage((message, from) => page.received.push({ from, message }));
    link.onChange((connected) => page.changes.push(connected));
    return link.me;
  },
  connected: (): BrowserId[] => page.changes.at(-1) ?? [],
  /** Signing for others, with text in and base64url out, so the proof can pass them across. */
  sign: (text: string) => page.link!.sign(text),
  verify,
  idFor,
  thisBrowser,
};

Object.assign(window, { proof: page });
