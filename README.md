# JukeBot

**A local-first, agent-native jukebox runtime for humans, bots, scripts and network peers.**

Live site:

**https://michaelwave369.github.io/JukeBot/**

JukeBot is deliberately not just a music-player UI. Every controller shares governed boundaries rather than privileged back doors.

## Current build — v0.8.0 / Rung 3C3

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

### Signaling
- default Nostr matchmaking
- optional custom Nostr relays
- controlled self-hosted WebSocket relay lane
- controlled mode fails closed
- optional TURN fallback
- relay health/status smoke-tested in CI

### Physical network qualification

JukeBot now includes a field qualification harness inside the Party Room host UI.

The harness covers nine required scenarios:

- same-LAN Nostr
- cellular/WAN Nostr
- controlled WebSocket relay
- TURN fallback
- disconnect/reconnect idempotency
- multiple simultaneous guests
- native Reality Ledger linkage
- Suno hosted-source acceptance
- host stop/restart/rejoin

The overall result can only become:

```text
FIELD_QUALIFIED
```

when every required scenario is PASS and each PASS has matching machine evidence plus a field note.

Otherwise the result stays `PARTIAL` or becomes `FAIL`.

The qualification export uses schema:

```text
jukebot.party.qualification.v1
```

It deliberately excludes:

- Party secrets
- TURN credentials
- relay URLs
- peer IDs
- IP addresses
- media URLs and bytes

See [docs/QUALIFICATION.md](docs/QUALIFICATION.md).

## Validation

```bash
npm run check
```

The software gate validates runtime, replay, Suno, Party protocol, transport profiles, controlled relay boot/health/status/shutdown, qualification logic, TypeScript and the production build.

CI does **not** claim physical qualification. Real devices must complete the field matrix.

## Run locally

Requires Node.js 22+.

```bash
git clone https://github.com/MichaelWave369/JukeBot.git
cd JukeBot
npm install
npm run dev
```

## Controlled relay

```bash
npm run relay:start
```

See [relay/README.md](relay/README.md).

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

The qualification session stores only safe evidence locally in the browser. Party secrets, peer IDs, TURN credentials and media URLs are excluded.

## Audio policy

JukeBot does not ship copyrighted music or bypass provider protections. Native playback uses media the operator supplies. Suno playback remains hosted by Suno.

## License

MIT
