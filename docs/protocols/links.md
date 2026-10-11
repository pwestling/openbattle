# Links

Links into Open Battle are a protocol too: other sites, army builders, Discord bots and forks make them. The **Open link** is the one meant for everyone, and it is stable. The other parameters are the app's own and are provisional.

A link is any page of the app (`https://<site>/<path>/`) with these in its query or `#fragment`. The public site is `https://openbattle.thehivemind5.com/`; a self-hosted site works the same way on its own address.

## Open link

**Version 1. Stable.** Code: `useOpenLink` and `fetchShared` in `src/share/links.ts`. Tests: `src/share/links.test.ts`.

```
https://<site>/?open=<url-encoded source>[#key=<key>]
```

This is how another site says "open this in Open Battle". The app fetches the source, shows the player what it is (kind, name, size, SHA-256) and opens it only after they say yes. Then it removes `open` and `#key` from the address bar, so a reload doesn't ask again.

**`open`** is one of these:

- An `https://` URL to an Open Battle file ([files.md](files.md)) or another format the app opens from a file: an army, table, figure pack, standee, replay, or a Yellowscribe list. The server must allow other sites to read it (CORS: `Access-Control-Allow-Origin: *` or the app's origin). A `github.com/<owner>/<repo>/blob/…` page link is turned into its raw file address.
- A `magnet:?xt=urn:btih:<40 hex>` link to a torrent of one such file, shared between browsers over WebTorrent. Its `ws=` web seeds whose address ends in the file's SHA-256 (`…/<64 hex>`) are fetched directly when no peer has the file, and the bytes are checked against that hash ([sharing-files.md](../sharing-files.md)).
- A `data:application/json;base64,<base64 or base64url>` URL carrying the file itself, for an army (any army format, Army list 1 included) or a table. Nothing is fetched. Use it when there is nowhere to host the file, such as an army builder's "Open in Open Battle" button. Remember to URL-encode it: a raw `+` in a query string reads as a space (the app puts it back, but other tools may not).

**`#key=`** is set only for a private file: 43 base64url characters, an AES-256-GCM key. A private file's bytes are `OBX1`, then a 12-byte IV, then the AES-GCM ciphertext of the file (`encrypt` in `src/share/torrent.ts`). The key goes in the fragment because browsers never send the fragment to a server.

What the app does with the file is decided by the file itself, by its `format` line (`sharedKind`), not by the link. So a new kind of file becomes linkable by teaching `sharedKind` to recognise it, with no new parameter. A file from a newer Open Battle is named as such ("saved by a newer Open Battle") instead of being called unreadable.

**Limits.** 96 MB per file, 64 KB for a `data:` source. Only https, magnet and `data:application/json;base64` sources. The player is always asked, so a link can never open something silently.

**Making one.** URL-encode the source: `https://<site>/?open=${encodeURIComponent(fileUrl)}`. Open Battle's own _Share_ button makes these links. Every other parameter (below) may be added alongside.

**What will not change in version 1:** the parameter names `open` and `key`, the https, magnet and `data:` sources, the private-file layout above, and the rule that the player is always asked. Anything new (a new source scheme, a new kind for `data:`) is added under the same rules and listed here; a change that would break existing links means Open link 2.

## Other links

Provisional: they work today, are listed so nothing depends on them by accident, and may change with a release note.

| Parameter                                                                                                        | What it does                                                     | Code                                       |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `?room=<id>`                                                                                                     | Join a game room (an invite link)                                | `src/ui/Lobby.tsx`                         |
| `?local=1`                                                                                                       | Open the room as a same-browser game                             | `src/ui/Lobby.tsx`                         |
| `?rules=rift-lanterns` / `?rules=brinewatch`                                                                     | Start with one of our own games chosen                           | `src/ui/Lobby.tsx`                         |
| `?play=<game>`                                                                                                   | Land on that game's _How hard?_ (from a watched game)            | `src/ui/Lobby.tsx`                         |
| `?review=1`, `?game=`                                                                                            | Open a review room                                               | `src/ui/Lobby.tsx`, `src/replay/review.ts` |
| `?tables=1`                                                                                                      | Open the open tables board                                       | `src/ui/Lobby.tsx`                         |
| `?view=broadcast`, `?delay=`, `?exhibition=1`                                                                    | Broadcast and exhibition views                                   | `src/broadcast/`                           |
| `?workshop=<https url>`                                                                                          | Open a module in the workshop                                    | `src/workshop/open.ts`                     |
| `#mail=<base64url JSON {url,id}>`                                                                                | A play-by-mail mailbox invite                                    | `src/mail/mailbox.ts`                      |
| `?signal= ?nostr= ?turn= ?turnUser= ?turnPass= ?forceTurn=1 ?mailbox= ?openTables= ?board= ?trackers= ?seeders=` | Network settings for this page; invites keep them (`NET_PARAMS`) | `src/net/config.ts`                        |

A room id is a capability: anyone with the link can join the room. Network parameters change which servers the page talks to, so a link from someone you don't trust can point you at their relay; it can't change the game's rules or bypass a consent screen.
