# Party Room

Party Room turns the live GitHub Pages JukeBot into a cross-device request room without giving guests playback authority.

## Normal host flow

1. Open JukeBot on the playback/library device.
2. Expand **TRANSPORT PROFILE**.
3. Choose a signaling strategy.
4. Press **START PARTY ROOM**.
5. Show the QR code or copy the invite link.
6. Guests scan the invite and request tracks.
7. Accept or refuse each request.

## Strategy 1 — Nostr matchmaking

This remains the default.

Use:

```text
SIGNALING STRATEGY = NOSTR MATCHMAKING
```

With no custom URLs, Trystero uses its normal Nostr relay pool.

You can instead supply custom Nostr `wss://` relay URLs.

## Strategy 2 — Controlled WebSocket relay

Use:

```text
SIGNALING STRATEGY = CONTROLLED WS RELAY
```

Then provide one or more relay URLs:

```text
wss://relay.example.com
```

Controlled mode is fail-closed.

If no valid relay URL exists, JukeBot will not start the room.

It will not quietly use Nostr instead.

## Run the included relay

From the repository root:

```bash
npm install
npm run relay:start
```

Default local endpoint:

```text
ws://localhost:8080
```

Health:

```text
http://localhost:8080/healthz
```

Status:

```text
http://localhost:8080/status
```

The status response includes uptime, active subscription count and configured limits.

For a GitHub Pages client, expose the relay through TLS as `wss://`.

See [../relay/README.md](../relay/README.md).

## What the relay sees

The controlled relay is signaling infrastructure used by Trystero to establish WebRTC peers.

It is not JukeBot playback authority.

It does not receive the host's local audio crate as a media service.

Once peers establish the WebRTC connection, JukeBot Party messages use that peer connection.

## TURN fallback

Both Nostr and controlled relay strategies support the existing optional TURN profile.

TURN solves a different problem:

- signaling relay: helps peers discover/exchange WebRTC signaling
- TURN: relays WebRTC traffic when peers cannot establish a direct path

TURN credentials remain session-only and should be ephemeral/time-limited.

## Invite profile

The invite fragment can carry:

- room password
- signaling strategy
- relay URLs
- optional TURN profile

Example:

```text
...?party=<room>&host=<host>
#key=<room-secret>&net=<encoded-profile>
```

The guest automatically applies the host-selected strategy.

## Diagnostics

The Party panel reports:

- secure context
- WebRTC
- Web Crypto
- WebSocket
- online state
- signaling strategy/profile
- TURN fallback

Relay/socket failures are classified separately from ICE/TURN failures.

## Authority remains unchanged

Transport selection changes reachability, not permissions.

Guests still cannot directly play, pause, skip, change volume, mutate the crate or bypass host accept/refuse.

## Physical qualification

Rung 3C3 will qualify the full system on real devices and network paths:

- same-LAN PC ↔ phone
- WAN/cellular guest
- controlled relay
- restrictive NAT with TURN
- disconnect/reconnect soak
- multiple simultaneous guests
