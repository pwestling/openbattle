import { describe, expect, it } from "vitest";
import { hashPath, legacyPath, parts } from "./route";

describe("addresses", () => {
  it("reads a screen from the hash, and leaves other hashes alone", () => {
    expect(hashPath("")).toBe("/");
    expect(hashPath("#/tables")).toBe("/tables");
    expect(hashPath("#/play/rift-lanterns/")).toBe("/play/rift-lanterns");
    expect(hashPath("#mail=abc")).toBeNull();
    expect(hashPath("#key=xyz")).toBeNull();
  });

  it("reads the old query links as their screens", () => {
    expect(legacyPath("?tables=gone")).toBe("/tables");
    expect(legacyPath("?rules=brinewatch")).toBe("/rules/brinewatch");
    expect(legacyPath("?play=forty-k-11")).toBe("/play/forty-k-11");
    expect(legacyPath("?room=ab12cd34")).toBeNull();
    expect(parts("/play/x/computer")).toEqual(["play", "x", "computer"]);
  });
});
