# JukeBot

**A local-first, agent-native jukebox runtime for humans, bots, scripts and network peers.**

Live site after the Pages workflow deploys from `main`:

**https://michaelwave369.github.io/JukeBot/**

JukeBot is deliberately not just a music-player UI. Its core rule is that every controller uses the same governed action boundary:

```text
Controller -> Observation -> Action Bus -> Authority -> Room State
                                            |
                                            +-> Receipt Ledger
                                                     |
                                          Audio / UI / Network adapters
```

## Current build — v0.2.0 / Rung 2A

- React + Vite browser deck
- GitHub Pages deployment workflow
- Local audio file loading
- Direct audio URL loading
- IndexedDB-backed persistent crate
- Local audio Blobs survive page reloads
- Queue/current track/volume/ledger session restore
- Safe track removal from persistent storage and runtime state
- Browser restart restores the crate but does not autoplay
- Operator, DJ, guest, agent, replay and script roles
- Explicit authority policy
- Deterministic room reducer
- Receipt for every accepted or refused action
- Browser audio adapter isolated from the core
- `window.JukeBot` control API
- Vitest acceptance coverage
- GitHub Actions validation

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
JukeBot.observe()

JukeBot.submit({
  type: "PLAY"
}, {
  id: "my-agent",
  role: "agent",
  label: "My Agent"
})

JukeBot.ledger()
JukeBot.persistence
```

Controllers do not receive a privileged back door. They submit normal actions and authority decides whether those actions are allowed.

## Persistence model

Local media bytes are stored in the browser's IndexedDB database. Runtime-only `blob:` URLs are regenerated when JukeBot starts again. Room state and the latest 1,000 receipts are persisted alongside the crate.

Remote tracks store their direct URL rather than copying media bytes.

JukeBot intentionally resumes restored sessions in the stopped state so browser autoplay policy and operator intent remain authoritative.

## Audio policy

JukeBot does not ship copyrighted music and does not bypass streaming-service protections. It plays audio the operator supplies locally or through a direct playable URL.

## Architecture and roadmap

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT
