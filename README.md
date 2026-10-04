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
                         Replay / Native Audio / Source Adapters / Persistence
```

## Current build — v0.4.0 / Rung 3A

### Native deck
- React + Vite live GitHub Pages app
- local audio files and direct playable audio URLs
- persistent IndexedDB crate
- queue, transport, volume and safe restart behavior
- cover art, tags, metadata and search
- persistent named playlists

### Suno Deck
- persist a Suno playlist share URL as source provenance
- paste canonical Suno song or embed URLs
- optional `Track Title | https://suno.com/song/...` input
- deduplicate songs by Suno song UUID
- hosted Suno player rendered inside JukeBot
- JukeBot previous / next / direct track selection
- open the original Suno song or playlist in one click
- Suno source playlists persist in IndexedDB v3
- Suno manifests survive JukeBot session export/import

JukeBot does **not** scrape Suno pages, call private Suno endpoints or guess CDN audio URLs.

The embedded Suno player owns actual hosted playback. JukeBot can select which player is active, but does not claim song-ended or playback-position evidence that Suno has not exposed through a supported integration contract.

See [docs/SUNO_DECK.md](docs/SUNO_DECK.md).

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

Controllers do not receive a privileged native-playback back door. They submit normal actions and authority decides whether those actions are allowed.

## Persistence model

IndexedDB v3 stores:

- local media bytes
- active room snapshot
- up to the latest 1,000 receipts
- native JukeBot playlists
- Suno source playlists

Runtime-only `blob:` URLs are regenerated when JukeBot starts again.

Remote native tracks store their direct playable URL rather than copying media bytes.

JukeBot intentionally restores native playback in the stopped state so browser autoplay policy and operator intent remain authoritative.

## Session bundles

Session bundles are JSON evidence and library manifests. They contain:

- portable room snapshot
- room hash
- receipt ledger
- native playlists
- Suno playlist/source manifests
- track metadata
- remote native-track URLs when applicable

They do **not** contain local audio bytes or Suno-hosted audio bytes.

## Audio policy

JukeBot does not ship copyrighted music and does not bypass streaming-service protections. Native playback uses audio the operator supplies locally or through a direct playable URL. Suno playback remains hosted by Suno inside its player.

## Architecture and roadmap

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT
