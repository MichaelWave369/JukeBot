# JukeBot Roadmap

## Rung 1 — Local Deck ✅
Headless runtime, authority, receipts, browser UI, local files, direct audio URLs, crate, queue and transport.

## Rung 2A — Durable React Deck ✅
React/Vite, GitHub Pages, IndexedDB media storage and browser-restart recovery.

## Rung 2B — Library Intelligence ✅
Named playlists, tags, cover metadata, search, portable session bundles and deterministic replay.

## Rung 3A — Suno Deck ✅
Hosted Suno source adapter, playlist provenance and portable Suno manifests.

## Rung 3B — P2P Party Room ✅
QR joining, safe guest catalog, typed native/Suno requests, host authority, request dedupe, catalog freshness and Party receipts.

## Rung 3C1 — Transport Diagnostics + Portable Network Profile ✅
Browser readiness diagnostics, configurable Nostr relays/redundancy, optional TURN and private-fragment transport profiles.

## Rung 3C2 — Controlled Relay Adapter
Optional self-hosted Trystero WebSocket signaling with explicit strategy selection.

Acceptance:
- transport profile distinguishes `nostr` and `ws-relay`
- default remains Nostr
- controlled mode uses `@trystero-p2p/ws-relay`
- controlled mode requires explicit ws/wss relay URL(s)
- controlled mode never silently falls back to Nostr
- QR invite carries strategy and relay URLs in the private fragment
- guest automatically joins using the host-selected strategy
- TURN remains compatible with either strategy
- repository includes runnable relay service
- relay exposes health and status endpoints
- relay has bounded topic/subscription defaults
- relay shuts down cleanly
- CI boots and probes the relay before build passes

## Rung 3C3 — Physical Network Qualification
Two-device LAN/WAN test matrix, restrictive NAT/TURN qualification, mobile browser matrix, disconnect/reconnect soak and connection-evidence receipts.

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
