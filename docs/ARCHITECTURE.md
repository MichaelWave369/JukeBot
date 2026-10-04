# JukeBot Architecture

JukeBot is built as a music runtime first and a visual jukebox second.

## Control flow

```text
Human / DJ / Guest / Agent / Replay / Script / Remote Peer
                         |
                         v
                    ActionEnvelope
                         |
                         v
                     Action Bus
                         |
                         v
                  Authority Policy
                    /         \
               REFUSE        ACCEPT
                 |              |
                 |              v
                 |        Deterministic Reducer
                 |              |
                 +-------> Receipt Ledger
                                |
                         portable room-v2 hash
                                |
                 +--------------+--------------+
                 |              |              |
                 v              v              v
              React UI      Audio Adapter   Persistence
                 |                             |
                 v                             v
          Replay / Bundles                 IndexedDB
```

No controller is allowed to mutate authoritative playback state directly.

## Runtime boundary

`src/core/*` remains headless and browser-independent. React, IndexedDB, browser audio and future network adapters sit outside the deterministic reducer.

The runtime can be constructed from a previously saved room snapshot and ledger. Hydration does not fabricate controller actions or retroactively rewrite receipts.

## Portable room-v2 hashing

Browser `blob:` URLs are temporary implementation details. They change when a local audio Blob is restored from IndexedDB.

A ledger that hashed those literal URLs could describe the same local track with a different hash after restart.

`room-v2` therefore hashes a portable projection of room state:

- local source URLs become `local://<track-id>`
- track tags are canonicalized for hashing
- meaningful metadata remains hash-relevant
- remote URLs remain hash-relevant

New receipts explicitly carry `stateHashVersion: "room-v2"`.

Receipts created before this rule are retained as legacy. The replay validator never silently upgrades a legacy hash.

## Replay validator

`src/core/replay.ts` replays receipts from the deterministic initial room state.

For each receipt it checks:

1. current authority policy agrees with accepted/refused status
2. accepted actions advance sequence exactly once
3. rejected actions do not advance sequence
4. room-v2 receipts reproduce their recorded state hash

Reports are:

- `EXACT` — complete v2 history replayed and hash-verified
- `MIXED_LEGACY` — legacy receipts were action/sequence replayed and the v2 tail was verified
- `PARTIAL` — the ledger prefix required for reconstruction is missing
- `MISMATCH` — authority or state hash evidence disagrees
- `EMPTY` — there is nothing to replay

## Durable crate boundary

`src/persistence/indexedDb.ts` owns browser persistence.

IndexedDB v2 stores:

- media records and local audio Blobs
- active room snapshot and up to 1,000 receipts
- named playlists

Persistent crate deletion is privileged and also removes dangling playlist references.

## Metadata authority

Track title, artist, tags and cover URL are authoritative room metadata. Updates are submitted through `UPDATE_TRACK_METADATA`, not patched directly by React.

Operator and DJ seats may edit metadata. Guest and agent seats may not.

## Session bundles

`src/core/bundle.ts` produces schema `jukebot.session.v1`.

A bundle contains the portable room snapshot, room hash, receipts, playlists and a media manifest.

Local audio bytes are deliberately excluded. Local manifest entries identify required media; remote entries may carry a direct URL.

On import:

- malformed/unsupported schemas are rejected
- deterministic receipt mismatches are refused by the UI
- remote media records can be reconstructed
- already-present local media can be matched
- missing local media is reported and omitted until the operator supplies it

## React surface

`src/App.tsx` projects runtime observation and exposes operator controls. It owns transient UI state such as search text and metadata forms, not authoritative playback state.

`window.JukeBot` exposes observation, ledger, replay validation and governed action submission for scripts and agents.

## GitHub Pages

Vite builds with production base path `/JukeBot/`. The Pages workflow runs the full validation gate before uploading and deploying `dist/`.

## Next boundary

Rung 3 adds a transport-neutral Party Room protocol so phones and remote peers submit the same governed action envelopes as local controllers.
