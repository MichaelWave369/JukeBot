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
                                v
                          Room Observation
                                |
                 +--------------+--------------+
                 |              |              |
                 v              v              v
              React UI      Audio Adapter   Persistence
                                              |
                                              v
                                           IndexedDB
```

No controller is allowed to mutate playback state directly.

## Runtime boundary

`src/core/*` remains headless and browser-independent. React, IndexedDB, browser audio and future network adapters sit outside the deterministic reducer.

The runtime can be constructed from a previously verified room snapshot and ledger. Hydration does not fabricate new controller actions or receipts.

## Durable crate boundary

`src/persistence/indexedDb.ts` owns browser persistence.

For local files:

1. The operator selects a browser `File`.
2. JukeBot stores the audio Blob in IndexedDB.
3. The runtime receives a temporary browser `blob:` URL.
4. Session snapshots replace that temporary URL with an `idb://` marker.
5. On restart, the Blob is read back and a fresh `blob:` URL is generated.
6. Restored transport is forced to `stopped`; JukeBot never silently resumes playback.

For direct URLs, the URL itself is the durable media reference.

The latest 1,000 receipts are retained with the active room snapshot.

## Authority

- Operator and DJ seats have full room authority.
- Guests may add/request tracks, but cannot operate transport.
- Agents may add/request and operate queue/transport, but cannot change master volume.
- Persistent crate deletion is intentionally withheld from agent/guest seats.
- Replay and script seats use the governed controller path rather than direct state mutation.

## React surface

`src/App.tsx` is a projection of runtime observation plus operator controls. It does not own authoritative playback state.

`window.JukeBot` remains available for governed script and agent control even though the visible deck is React-based.

## GitHub Pages

Vite builds with the production base path `/JukeBot/`. The Pages workflow validates the test/build gate before uploading `dist/` and deploying it through GitHub's Pages Actions path.

## Next boundary

Rung 2B extends persistence with playlists, track tags, cover metadata, import/export bundles and deterministic receipt replay against matching durable media.
