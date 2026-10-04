# JukeBot

**A local-first, agent-native jukebox runtime for humans, bots, scripts and network peers.**

JukeBot is deliberately not just a music-player UI. Its core rule is that every controller uses the same governed action boundary:

```text
Controller -> Observation -> Action Bus -> Authority -> Room State
                                            |
                                            +-> Receipt Ledger
                                                     |
                                          Audio / UI / Network adapters
```

The browser app already provides a working local deck while the headless runtime gives later agents, replays and peers a stable control surface.

## Rung 1

- Local audio file loading
- Direct audio URL loading
- Crate/library and queue
- Play, pause, stop and skip
- Master volume
- Operator, DJ, guest, agent, replay and script roles
- Explicit authority policy
- Deterministic room reducer
- Receipt for every accepted or refused action
- Browser audio adapter isolated from the core
- `window.JukeBot` control API
- Vitest acceptance coverage
- GitHub Actions validation

## Run it

Requires Node.js 22+.

```bash
git clone https://github.com/MichaelWave369/JukeBot.git
cd JukeBot
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

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
```

Controllers do not receive a privileged back door. They submit normal actions and authority decides whether those actions are allowed.

## Audio policy

JukeBot does not ship copyrighted music and does not bypass streaming-service protections. Rung 1 plays audio the operator supplies locally or through a direct playable URL.

## Architecture and roadmap

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT
