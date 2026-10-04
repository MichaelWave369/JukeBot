# JukeBot Controlled WebSocket Relay

This service is optional. JukeBot's default Party Room still uses Trystero's Nostr matchmaking strategy.

Use the controlled relay when you want to own the signaling path.

## What it carries

The relay carries Trystero signaling topics used to establish WebRTC peer connections.

It does **not** carry JukeBot audio/media payloads after peers connect.

JukeBot Party messages continue over WebRTC.

## Run locally

From the repository root:

```bash
npm install
npm run relay:start
```

Defaults:

- host: `0.0.0.0`
- port: `8080`
- health: `/healthz`
- status: `/status`

Local browser URL:

```text
ws://localhost:8080
```

A GitHub Pages host must use a secure WebSocket endpoint:

```text
wss://relay.example.com
```

Put TLS in front of this service with your hosting platform, reverse proxy, or load balancer.

## Environment

```text
HOST=0.0.0.0
PORT=8080
MAX_TOPIC_LENGTH=256
MAX_SUBSCRIPTIONS_PER_SOCKET=128
MAX_SUBSCRIPTIONS=10000
```

The defaults match the upstream relay's conservative limits.

## Docker

Build from the repository root:

```bash
docker build -f relay/Dockerfile -t jukebot-relay .
docker run --rm -p 8080:8080 jukebot-relay
```

## Production boundary

The relay is signaling infrastructure, not playback authority.

Running your own relay does not give guests additional JukeBot permissions and does not bypass host accept/refuse rules.

For public deployment:

- terminate TLS and expose `wss://`
- restrict administrative network access separately
- monitor `/healthz` and `/status`
- place connection/rate limits at the edge when exposed publicly
- do not embed TURN credentials in this service
