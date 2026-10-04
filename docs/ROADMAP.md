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

## Rung 3C2 — Controlled Relay Adapter ✅
Optional operator-controlled Trystero WebSocket signaling, fail-closed strategy selection, relay runtime, health/status endpoints and relay smoke qualification.

## Rung 3C3 — Physical Network Qualification
Evidence-backed real-device qualification.

Software acceptance:
- qualification schema is deterministic
- required physical scenarios are frozen
- PASS can require machine-observed evidence
- contradictory PASS evidence forces overall FAIL
- blocked/unrun scenarios remain PARTIAL
- qualification export contains no room secret, TURN credential, relay URL, peer ID, IP or media URL
- imported overall status is recomputed instead of trusted
- safe observation counters are captured in the host UI
- CI tests the qualification engine but never claims physical readiness

Physical acceptance:
- same-LAN PC ↔ physical guest via Nostr
- cellular/WAN guest via Nostr
- controlled WebSocket relay path
- TURN fallback on a restrictive path
- disconnect/reconnect retry remains idempotent
- two or more simultaneous guests
- accepted native request links Party receipt to Reality Ledger
- accepted Suno request stays on hosted-source evidence lane
- host stop/new-room/rejoin succeeds
- all nine scenarios PASS in one exported field qualification session

Only then may the Party network state be labeled `FIELD_QUALIFIED`.

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
