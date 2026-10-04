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
          +---------------------+----------------------+
          |                     |                      |
          v                     v                      v
       React UI          Native Audio Adapter      Persistence
          |                                            |
          v                                            v
   Hosted Sources                                  IndexedDB v3
     /      \
 Suno Deck  future adapters
```

No controller is allowed to mutate authoritative native playback state directly.

## Runtime boundary

`src/core/*` remains headless and browser-independent. React, IndexedDB, browser audio, hosted-source adapters and future network adapters sit outside the deterministic reducer.

The runtime can be constructed from a previously saved room snapshot and ledger. Hydration does not fabricate controller actions or retroactively rewrite receipts.

## Native audio vs hosted sources

JukeBot distinguishes two different realities:

### Native audio

Local files and direct playable audio URLs are controlled by `BrowserAudioAdapter`. JukeBot owns their queue/transport state and can issue governed receipts for those actions.

### Hosted sources

A hosted source such as Suno keeps playback inside the provider's player.

JukeBot may:

- retain source provenance
- select a hosted item
- render the provider's hosted player
- preserve a portable source manifest
- provide navigation to the original provider page

JukeBot must not claim provider-internal facts such as exact playback position, song-ended events or successful audio delivery unless the provider exposes a supported integration contract for those facts.

## Suno Deck

`src/sources/suno.ts` accepts canonical Suno song and embed URLs and extracts the stable song UUID.

Supported source forms:

```text
https://suno.com/song/<uuid>
https://suno.com/embed/<uuid>
```

Suno playlist URLs are stored separately as provenance:

```text
https://suno.com/playlist/<uuid>
```

The source adapter does not scrape playlist pages or derive direct CDN audio URLs.

`src/components/SunoDeck.tsx` renders one active Suno-hosted player and lets the operator switch among a persisted Suno playlist manifest.

## Durable persistence

`src/persistence/indexedDb.ts` owns browser persistence.

IndexedDB v3 stores:

- media records and local audio Blobs
- active room snapshot and up to 1,000 receipts
- native named playlists
- Suno source playlists

Persistent native-crate deletion is privileged and also removes dangling native-playlist references.

## Portable room-v2 hashing

Browser `blob:` URLs are temporary implementation details. They change when a local audio Blob is restored from IndexedDB.

`room-v2` hashes a portable projection of authoritative native room state:

- local source URLs become `local://<track-id>`
- track tags are canonicalized for hashing
- meaningful metadata remains hash-relevant
- remote native URLs remain hash-relevant

Hosted-source player internals are not silently folded into this native room hash.

## Replay validator

`src/core/replay.ts` replays native-room receipts from the deterministic initial room state.

Reports are:

- `EXACT`
- `MIXED_LEGACY`
- `PARTIAL`
- `MISMATCH`
- `EMPTY`

## Session bundles

`src/core/bundle.ts` produces schema `jukebot.session.v1`.

A bundle contains:

- portable native room snapshot and hash
- native-room receipt ledger
- native playlists
- Suno source-playlist manifests
- native media manifest

Local audio bytes and Suno-hosted audio bytes are deliberately excluded.

## React surface

`src/App.tsx` projects runtime observation and exposes operator controls. `SunoDeck` is a hosted-source surface, not a secret path into the native reducer.

`window.JukeBot` exposes observation, ledger, replay validation and governed native action submission for scripts and agents.

## GitHub Pages

Vite builds with production base path `/JukeBot/`. The Pages workflow runs the full validation gate before uploading and deploying `dist/`.

## Next boundary

Rung 3B adds a transport-neutral Party Room protocol so phones and remote peers can submit governed requests while preserving whether a selection is native media or a hosted source.
