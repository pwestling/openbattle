# Ranked results

**`v: 1`**. Stable. Schema: [signed-result.v1](../../schemas/signed-result.v1.schema.json). Fixtures: [`conformance/signed-result/v1`](../../conformance/signed-result/v1). Code: `RankedResult` and `canonResult` in `src/core/ranked.ts`, `checkSigned` in `src/ranked/verify.ts`.

A ranked result is what both players of a ranked game sign. It travels over the [board](../board-protocol.md) and is counted by every client for itself, so any implementation that signs and checks results the same way can join the ladders. Which ladder a result counts on is in [compatibility.md](../compatibility.md#ranked-games-and-ladders).

## The document

```json
{
  "result": {
    "v": 1,
    "system": "rift-lanterns",
    "points": null,
    "rounds": 5,
    "players": [
      { "key": "<x>.<y>", "name": "Ana", "vp": 12 },
      { "key": "<x>.<y>", "name": "Ben", "vp": 8 }
    ],
    "winner": 0,
    "replay": "<64 hex: SHA-256 of the game record>",
    "at": 1760000000000,
    "event": { "id": "…", "round": 1, "table": 3 },
    "rules": {
      "app": "0.1.0",
      "packages": [{ "id": "…", "name": "…", "version": "1.0.0", "hash": "<64 hex>", "game": true }]
    }
  },
  "sigs": ["<base64 signature by players[0]>", "<base64 signature by players[1]>"]
}
```

- A player's `key` is their ECDSA P-256 public key: its JWK `x` and `y`, base64url, joined by a dot.
- `winner` is the seat with more `vp`, or `null` for a draw. It must agree with the scores.
- `event` appears only for a game played at an [online event](../board-protocol.md). `rules` appears only when known. Without them the canonical text leaves them out, so older results still verify.

## Signing

1. Make the canonical text, `canonResult(result)`: `JSON.stringify` of exactly the fields above, in exactly this order: `v, system, points, rounds, players (key, name, vp each), winner, replay, at (rounded), event (id, round, table), rules (app, then packages sorted by id, each id, name, version, hash, game when true)`. Any field outside this list is not signed. A result that breaks a limit isn't a result: system up to 80 characters, names up to 32, `vp` 0 to 9999, rounds 0 to 99, points null or 1 to 99999, two different keys.
2. Sign the UTF-8 bytes of `open-battle-result:` followed by the canonical text with ECDSA P-256 and SHA-256 (WebCrypto's `{ name: "ECDSA", hash: "SHA-256" }`, so the signature is the 64-byte `r‖s` form). Base64 it.
3. `sigs[i]` is the signature by `players[i].key`. A result counts only with both, each by its own seat's key.

A declined result carries the decliner's own signature on their refusal and never counts. See `DeclinedResult` in `src/ranked/verify.ts`.

## Checking

Recompute the canonical text from the received result; never trust a text that came with it. Verify both signatures against the keys in `players`. A conforming checker accepts every file in `conformance/signed-result/v1/valid/` and rejects every file in `invalid/`.
