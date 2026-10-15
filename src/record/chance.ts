// Rolls and shuffled draws from the two values of the sealed exchange (ADR-008).
// Every browser derives the same numbers from the same two values; nothing here is random.
import { sha256, sha256Words } from "./sha256.ts";
import type { Sealed } from "./types.ts";

/** Whether the host's value opens its seal: the seal is the hex SHA-256 of hostValue. */
export function opens(sealed: Sealed): boolean {
  return sha256(sealed.hostValue) === sealed.seal;
}

/**
 * A stream of whole numbers below a bound, fixed by both values. Each block of the stream is the
 * SHA-256 of both values and the block's number; each 32-bit word is used unless it would favour
 * small numbers (rejection sampling), so every number below the bound is equally likely.
 */
export function picker(sealed: Sealed): (below: number) => number {
  let block = 0;
  let words: Uint32Array = new Uint32Array(0);
  let next = 0;
  const word = () => {
    if (next === words.length) {
      words = sha256Words(`${sealed.hostValue}\n${sealed.guestValue}\n${block++}`);
      next = 0;
    }
    return words[next++]!;
  };
  return (below) => {
    // Up to 2^32, one word; above, two words make a 53-bit number, enough for any whole number.
    const wide = below > 2 ** 32;
    const span = wide ? 2 ** 53 : 2 ** 32;
    const fair = Math.floor(span / below) * below;
    for (;;) {
      const w = wide ? (word() & 0x1fffff) * 2 ** 32 + word() : word();
      if (w < fair) return w % below;
    }
  };
}

export function rollDice(sealed: Sealed, dice: number, sides: number): number[] {
  const pick = picker(sealed);
  return Array.from({ length: dice }, () => 1 + pick(sides));
}

/**
 * Which cards a shuffled draw takes, in the order picked. Each pick is from the cards still left,
 * in the deck's listed order, with the last card left moved into the picked card's place.
 */
export function drawFrom(sealed: Sealed, cards: string[], count: number): string[] {
  const pick = picker(sealed);
  const left = [...cards];
  return Array.from({ length: count }, () => {
    const at = pick(left.length);
    const card = left[at]!;
    left[at] = left[left.length - 1]!;
    left.pop();
    return card;
  });
}
