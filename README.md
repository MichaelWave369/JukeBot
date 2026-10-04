# JukeBot

**A local-first, agent-native jukebox runtime for humans, bots, scripts and network peers.**

Live site:

**https://michaelwave369.github.io/JukeBot/**

JukeBot is deliberately not just a music-player UI. Its core rule is that every controller uses the same governed boundary:

```text
Local / Guest / Agent / Script / Remote Peer
                    |
                    v
               Request / Action
                    |
                    v
                Authority
                    |
             +------+------+
             |             |
          native         hosted
           room           source
             |             |
             v             v
        Reality Ledger   source receipt
```

## Current build — v0.5.0 / Rung 3B

### Native deck
- React + Vite live GitHub Pages app
- local audio files and direct playable audio URLs
- persistent IndexedDB crate
- queue, transport, volume and safe restart behavior
- cover art, tags, metadata and search
- persistent named playlists

### Suno Deck
- persistent Suno playlist provenance
- canonical Suno song/embed parsing
- hosted Suno player inside JukeBot
- previous / next / direct selection
- Suno manifests survive session export/import
- no scraping or guessed CDN audio URLs

### Party Room
- host can open a live cross-device request room from the GitHub Pages build
- invite is shareable as QR code or URL
- guests browse a safe request catalog from a phone
- native media URLs and local `blob:` URLs are never sent to guests
- native and Suno selections stay in separate source namespaces
- guests can request; only the host can accept/refuse
- accepted native requests enter the existing Action Bus as a real `guest` actor
- accepted Suno requests switch the hosted Suno selection
- duplicate reconnect retries reuse the same request ID and do not create duplicate pending requests
- stale guest catalogs are rejected and refreshed
- host decisions create Party receipts
- accepted native Party receipts point to the resulting native Reality Ledger receipt

The live network transport uses browser-to-browser WebRTC. JukeBot uses Trystero's default Nostr matchmaking strategy only to discover peers; room payloads move peer-to-peer after connection.

The room password is encoded in the invite URL fragment rather than normal query parameters. The invite also pins the expected host peer ID so a guest ignores host-like messages from other peers in the room.

See [docs/PARTY_ROOM.md](docs/PARTY_ROOM.md).

### Portable evidence
- `room-v2` hashes normalize temporary local `blob:` URLs
- deterministic native receipt replay
- `EXACT`, `MIXED_LEGACY`, `PARTIAL`, `MISMATCH`, `EMPTY`
- portable JSON session export/import
- missing local audio is reported instead of fabricated

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

JukeBot.submit({
  type: "PLAY"
}, {
  id: "my-agent",
  role: "agent",
  label: "My Agent"
})
```

Party guests do not receive this operator surface. Their phone sends source requests through the Party protocol; the host decides whether those requests become effects.

## Persistence model

IndexedDB v3 stores:

- local media bytes
- active native room snapshot
- up to the latest 1,000 native receipts
- native playlists
- Suno source playlists

Party rooms are intentionally ephemeral in v0.5.0. Stopping the room drops the live peer session and its Party receipts.

## Session bundles

Session bundles contain:

- portable native room snapshot
- native room hash
- native receipt ledger
- native playlists
- Suno source manifests
- track metadata
- remote native-track URLs when applicable

They do not contain local audio bytes, Suno-hosted audio bytes, Party room passwords, or live peer identifiers.

## Audio policy

JukeBot does not ship copyrighted music and does not bypass streaming-service protections. Native playback uses media the operator supplies. Suno playback remains hosted by Suno inside its player.

## Architecture and roadmap

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT
