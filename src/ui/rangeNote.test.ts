import { describe, expect, it } from "vitest";
import "../systems";
import { getSystem } from "../core/content";
import { rangeNote } from "./rangeNote";

const gun = (range: string) => ({ chars: { Range: range } });

describe("range notes", () => {
  it("40k: past the range is simply out of range", () => {
    const fk = getSystem("forty-k-11")!;
    expect(rangeNote(fk, gun("24"), 15, false)).toBeNull();
    expect(rangeNote(fk, gun("24"), 30, false)).toBe("out of range");
  });
});
