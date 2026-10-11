# Conformance suite

Frozen documents for Open Battle's interop formats ([docs/protocols](../docs/protocols/README.md)). Use them to check that your tool, fork or server reads and writes the formats the way Open Battle does.

```
conformance/<format>/v<major>/valid/*.json     every reader must accept these
conformance/<format>/v<major>/invalid/*.json   every reader must turn these away
schemas/<format>.v<major>.schema.json          JSON Schema (draft-07) for the format
```

- **Reader check:** your reader accepts every `valid/` file and rejects every `invalid/` file. Open Battle runs this against its own readers in `src/protocols/protocols.test.ts`: armies, tables and campaigns must read; a record must replay to a table; a mail file's and a ranked result's signatures must check out; a player file's keys must match.
- **Writer check:** what your writer produces validates against the schema. The schemas allow fields they don't name, as the [shared rules](../docs/protocols/README.md#the-rules-every-protocol-keeps) say readers must.
- **Invalid files** cover the cases every reader must handle: a newer major version than it knows, and a document that breaks a rule its version promises (missing signatures, a wrong type).

These files are never edited or removed. A new major version gets its own `v<major>/` folder, and the old one stays, because builds keep reading every major they ever read. Adding a new format's fixtures: see [docs/protocols/README.md](../docs/protocols/README.md#adding-or-changing-a-protocol).

The names in these files are invented. The keys in `player/` and `signed-result/` were made for the test and sign nothing real.
