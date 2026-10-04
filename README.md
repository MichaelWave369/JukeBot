# JukeBot

**A local-first, agent-native jukebox runtime for humans, bots, scripts and network peers.**

Live site:

**https://michaelwave369.github.io/JukeBot/**

JukeBot is deliberately not just a music-player UI. Its core rule is that every controller uses the same governed action boundary:

```text
Controller -> Observation -> Action Bus -> Authority -> Room State
                                            |
                                            +-> Receipt Ledger
                                                     |
                                     Replay / Audio / UI / Persistence
```

## Current build — v0.3.0 / Rung 2B

### Deck
- React + Vite live GitHub Pages app
- local audio files and direct playable audio URLs
- persistent IndexedDB crate
- queue, transport, volume and safe restart behavior
- cover-art URL support

### Library intelligence
- search by title, artist or tag
- governed metadata editing
- persistent tags
- named playlists
- save current queue as a playlist
- load and delete playlists
- safe cleanup of playlist references when tracks are removed

### Portable evidence
- `room-v2` state hashes normalize temporary local `blob:` URLs
- deterministic receipt replay validator
- replay states: `EXACT`, `MIXED_LEGACY`, `PARTIAL`, `MISMATCH`, `EMPTY`
- legacy receipts remain explicitly legacy
- portable JSON session export/import
- import refuses a deterministic replay mismatch
- missing local audio is reported rather than fabricated

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

Open the browser console:

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

Controllers do not receive a privileged playback back door. They submit normal actions and authority decides whether those actions are allowed.

## Persistence model

Local media bytes are stored in the browser's IndexedDB database. Runtime-only `blob:` URLs are regenerated when JukeBot starts again. Room state, playlists and up to the latest 1,000 receipts are persisted.

Remote tracks store their direct URL rather than copying media bytes.

JukeBot intentionally restores playback in the stopped state so browser autoplay policy and operator intent remain authoritative.

## Session bundles

Session bundles are JSON evidence and library manifests, not secret ZIP archives full of somebody's music collection.

They contain:

- portable room snapshot
- room hash
- receipt ledger
- playlists
- track metadata
- remote track URLs when applicable

They do **not** contain local audio bytes.

A bundle imported on another device can restore remote tracks immediately. Local tracks are matched by media identity when already present; missing local files are reported so the operator can add them deliberately.

## Audio policy

JukeBot does not ship copyrighted music and does not bypass streaming-service protections. It plays audio the operator supplies locally or through a direct playable URL.

## Architecture and roadmap

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT
