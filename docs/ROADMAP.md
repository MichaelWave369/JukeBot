# JukeBot Roadmap

## Rung 1 — Local Deck ✅
Headless room runtime, authority, receipts, browser UI, local files, direct audio URLs, crate, queue and transport.

## Rung 2A — Durable React Deck ✅
React/Vite UI, GitHub Pages deployment, IndexedDB media storage, browser-restart crate recovery, room/session restoration and safe persistent deletion.

## Rung 2B — Library Intelligence ✅
Named playlists, tags, cover metadata, search/filtering, portable session bundles and deterministic receipt replay.

## Rung 3A — Suno Deck ✅
Hosted Suno source adapter, persistent Suno playlist manifests, playlist provenance, canonical song-ID parsing and session-bundle portability.

## Rung 3B — P2P Party Room
Live browser-to-browser request rooms from the GitHub Pages build.

Acceptance:
- host creates a random room and secret
- invite pins expected host peer ID
- QR/link secret stays in URL fragment
- guest receives a safe catalog without local/direct media URLs
- guest can request native or Suno selections
- remote guest never receives transport authority
- host explicitly accepts/refuses each request
- accepted native request becomes a normal guest Action Bus submission
- accepted native Party receipt links to its Reality Ledger receipt
- accepted Suno request switches only the hosted source selection
- reconnect retries reuse the same request ID
- duplicate request IDs with changed content are rejected
- stale catalogs are rejected
- queue/catalog snapshots converge after host state changes
- Party receipts record accepted/refused host decisions

## Rung 3C — Controlled Transport Adapters
Optional self-hosted WebSocket relay, LAN-friendly discovery, TURN configuration and deployment hardening while retaining `jukebot.party.v1` envelopes.

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
