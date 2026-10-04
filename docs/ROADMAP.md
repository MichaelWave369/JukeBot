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

## Rung 3C1 — Transport Diagnostics + Portable Network Profile
Deployment hardening without changing `jukebot.party.v1`.

Acceptance:
- browser reports secure-context/WebRTC/Web Crypto/WebSocket/online readiness
- host can tune default Nostr relay redundancy
- host can supply custom secure Nostr relay URLs
- host can supply optional TURN fallback
- custom transport profile is encoded only in the invite fragment
- guest automatically applies the host's profile
- invalid relay/TURN schemes are discarded
- TURN credentials are never persisted
- common join failures receive actionable classification
- existing Party protocol tests remain green

## Rung 3C2 — Controlled Relay Adapter
Optional self-hosted WebSocket signaling relay using Trystero's dedicated relay package, plus deploy/run documentation.

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
