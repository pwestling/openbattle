// Link: direct connections between the browsers in one game. Realizes design/surfaces/link.html.
import type { BrowserId, Json } from "../../server/protocol.ts";

export type { BrowserId, Json };

export interface Link {
  /** This browser's id, the same on every visit. */
  readonly me: BrowserId;
  send(message: Json, to?: BrowserId): void;
  onMessage(listener: (message: Json, from: BrowserId) => void): () => void;
  onChange(listener: (connected: BrowserId[]) => void): () => void;
  close(): void;
}

/** Rejects if the relay cannot be reached. */
export async function connect(link: string): Promise<Link> {
  throw new Error("link.connect is not built yet");
}
