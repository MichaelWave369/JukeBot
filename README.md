# JukeBot

**A local-first, agent-native jukebox runtime for humans, bots, scripts and network peers.**

Live site:

**https://michaelwave369.github.io/JukeBot/**

JukeBot is deliberately not just a music-player UI. Every controller shares governed boundaries rather than privileged back doors.

## Current build — v0.6.0 / Rung 3C1

### Native deck
- local audio files and direct playable audio URLs
- persistent IndexedDB crate
- queue, transport, volume and safe restart behavior
- cover art, tags, metadata, search and named playlists

### Suno Deck
- persistent Suno playlist provenance
- canonical Suno song/embed parsing
- hosted Suno player inside JukeBot
- previous / next / direct selection
- no scraping or guessed CDN audio URLs

### Party Room
- live browser-to-browser request rooms
- QR/link guest joining
- safe catalog with no native media URL leakage
- native and Suno request lanes
- host accept/refuse authority
- reconnect request dedupe
- stale-catalog rejection
- Party receipts linked to native Reality Ledger receipts when applicable

### Transport hardening
Rung 3C1 adds an inspectable network profile instead of a mysterious "connection failed" shrug.

Host controls now include:

- browser capability diagnostics
- secure-context / WebRTC / Web Crypto / WebSocket / online checks
- default Nostr relay redundancy selection
- optional custom Nostr `wss://` relay URLs
- optional TURN fallback
- connection-failure classification with TURN guidance

Custom network settings are **session-only**.

When a host configures a custom network profile, JukeBot places that profile in the Party invite URL fragment so the phone receives the same settings automatically.

TURN credentials are never committed to the repository or put in ordinary query parameters. If supplied, they travel in the private invite fragment and should therefore be **short-lived/ephemeral credentials**, not a permanent TURN account password.

The default path remains Trystero's Nostr matchmaking plus direct WebRTC.

See [docs/PARTY_ROOM.md](docs/PARTY_ROOM.md).

### Portable evidence
- portable `room-v2` hashes
- deterministic native receipt replay
- portable JSON session bundles
- explicit native vs hosted-source evidence boundaries

## Run locally

Requires Node.js 22+.

```bash
git clone https://github.com/MichaelWave369/JukeBot.git
cd JukeBot
npm install
npm run dev
```

## Validate

```bash
npm run check
```

## Agent/script API

```js
JukeBot.version
JukeBot.observe()
JukeBot.ledger()
JukeBot.replay()
JukeBot.submit(...)
```

## Persistence model

IndexedDB stores local media, native room state, recent receipts, native playlists and Suno source playlists.

Party rooms and transport credentials remain ephemeral. Session bundles do not contain Party room passwords, TURN credentials, or live peer identifiers.

## Audio policy

JukeBot does not ship copyrighted music or bypass provider protections. Native playback uses media the operator supplies. Suno playback remains hosted by Suno.

## Architecture and roadmap

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT
