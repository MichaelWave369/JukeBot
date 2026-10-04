# JukeBot

**A local-first, agent-native jukebox runtime for humans, bots, scripts and network peers.**

Live site:

**https://michaelwave369.github.io/JukeBot/**

JukeBot is deliberately not just a music-player UI. Every controller shares governed boundaries rather than privileged back doors.

## Current build — v0.7.0 / Rung 3C2

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

### Signaling strategies

Party Room now has two explicit signaling strategies.

#### Nostr matchmaking

Default lane:

```text
JukeBot host/guest
      |
      v
Trystero Nostr signaling
      |
      v
WebRTC peer connection
```

The host may use the default Nostr pool or explicit Nostr relay URLs.

#### Controlled WebSocket relay

Operator-owned lane:

```text
JukeBot host/guest
      |
      v
@trystero-p2p/ws-relay
      |
      v
your wss:// relay
      |
      v
WebRTC peer connection
```

Controlled mode is **fail-closed**. It requires at least one explicit relay URL and does not silently fall back to public Nostr.

The relay carries signaling used to establish WebRTC. Party application payloads continue peer-to-peer after the connection forms.

### Included relay service

The repository contains a runnable relay in `relay/`.

```bash
npm install
npm run relay:start
```

Endpoints:

- `GET /healthz`
- `GET /status`

A Dockerfile is included at `relay/Dockerfile`.

For GitHub Pages clients, expose the service behind TLS as a `wss://` endpoint.

### Validation

`npm run check` now includes:

- runtime tests
- replay tests
- Suno tests
- Party protocol/transport tests
- controlled relay process smoke test
- TypeScript validation
- production Vite build

The relay smoke test boots the service on an ephemeral port, verifies `/healthz` and `/status`, and shuts it down cleanly.

### TURN

Both signaling strategies can use the existing optional TURN profile for restrictive NAT/firewall cases.

TURN credentials remain session-only and should be ephemeral/time-limited.

See [docs/PARTY_ROOM.md](docs/PARTY_ROOM.md) and [relay/README.md](relay/README.md).

## Run locally

Requires Node.js 22+.

```bash
git clone https://github.com/MichaelWave369/JukeBot.git
cd JukeBot
npm install
npm run dev
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

Party room secrets, live peer IDs, TURN credentials and controlled-relay session settings are not written into session bundles.

## Audio policy

JukeBot does not ship copyrighted music or bypass provider protections. Native playback uses media the operator supplies. Suno playback remains hosted by Suno.

## License

MIT
