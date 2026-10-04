# JukeBot Roadmap

## Rung 1 — Local Deck ✅
Headless room runtime, authority, receipts, browser UI, local files, direct audio URLs, crate, queue and transport.

## Rung 2A — Durable React Deck ✅
React/Vite UI, GitHub Pages deployment, IndexedDB media storage, browser-restart crate recovery, room/session restoration and safe persistent deletion.

## Rung 2B — Library Intelligence ✅
Named playlists, tags, cover metadata, search/filtering, portable session bundles and deterministic receipt replay.

## Rung 3A — Suno Deck
Hosted Suno song-player source adapter, persistent Suno playlist manifests, playlist provenance, canonical song-ID parsing and session-bundle portability.

Acceptance:
- canonical Suno song and embed links resolve to one stable song ID
- duplicate Suno song IDs are rejected
- invalid/non-Suno links are reported
- Suno playlist share URL is retained as provenance
- hosted player renders without exposing credentials
- no private API, page scraping or guessed CDN audio URL is required
- Suno playlist manifests survive IndexedDB restart and session export/import

## Rung 3B — Party Room
Host/guest protocol, QR request page, LAN room discovery and WebSocket transport. Guests request; host authority decides.

Planned acceptance:
- host owns transport authority
- guest joins without receiving host secrets
- guest request becomes a normal governed action
- queue convergence is testable
- disconnect/reconnect does not silently duplicate requests
- a room receipt records accepted/refused remote actions
- LAN and hosted transports share the same protocol envelope
- source identity distinguishes native media from hosted-source selections

## Rung 4 — Agent Seats
Stable observation schema, action schema, JukeBot DJ policies, PhiBot bridge and governed external-model adapters.

## Rung 5 — Smart Deck
Web Audio graph, crossfade, gain staging, loudness normalization, cue points, waveform analysis, optional BPM/key estimation and automix suggestions.

## Rung 6 — Commonline
Voice requests, room announcements, bot/DJ handoff and shared session presence through a Commonline adapter.

## Rung 7 — PhiOS / Desktop
Installable PWA plus native shell packaging, local media indexing and OS-level media controls.

## Rung 8 — Replayable Sessions
Portable session bundles with media manifests, room policy, agent decisions, replay receipts and deterministic reconstruction across compatible runtimes.
