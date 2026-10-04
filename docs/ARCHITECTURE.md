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
                    +-----------+-----------+
                    |                       |
                    v                       v
                Browser UI             Audio Adapter
```

No controller is allowed to mutate playback state directly.

## Rung 1 boundaries

- `src/core/*` is headless and browser-independent.
- `BrowserAudioAdapter` performs the physical audio side effect.
- The UI submits the same actions exposed to `window.JukeBot`.
- Every accepted or refused action creates a receipt.
- Guests can add/request music, but cannot operate transport.
- Agents can operate queue/transport but cannot change master volume.
- Operator/DJ seats hold full authority.

## What is deliberately not in Rung 1

Streaming-service circumvention, DRM bypassing, scraping copyrighted catalogs, accounts, cloud sync, peer networking, automatic BPM analysis and AI model calls are all outside the initial trusted core.

Those belong in later adapters and must not contaminate the deterministic room reducer.
