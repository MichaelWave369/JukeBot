# Party Room

Party Room turns the live GitHub Pages JukeBot into a cross-device request room without giving guests playback authority.

## Host flow

1. Open JukeBot on the playback/library device.
2. Choose a signaling strategy under **TRANSPORT PROFILE**.
3. Start the Party Room.
4. Show the QR code or copy the invite.
5. Guests request tracks.
6. Host accepts or refuses each request.
7. Use **FIELD EVIDENCE** to record physical qualification runs.

## Signaling strategies

### Nostr matchmaking

Default strategy.

You may use Trystero's default Nostr pool or explicit custom Nostr relay URLs.

### Controlled WebSocket relay

Choose **CONTROLLED WS RELAY** and provide at least one ws/wss relay URL.

Controlled mode fails closed. It never silently falls back to Nostr.

The repository includes a relay runtime:

```bash
npm run relay:start
```

See [../relay/README.md](../relay/README.md).

## TURN

TURN is independent of signaling.

- signaling answers how peers exchange WebRTC connection information
- TURN relays WebRTC traffic when peers cannot establish a direct path

TURN credentials are session-only and should be short-lived.

## Safe guest catalog

Guests receive requestable metadata, not native audio source URLs.

The Party catalog excludes:

- local Blob URLs
- direct host audio URLs
- local media bytes
- IndexedDB records

## Host authority

Guests cannot directly play, pause, skip, change volume, edit metadata, mutate the crate or delete media.

Accepted native requests enter the normal Action Bus as a `guest` actor.

Accepted Suno requests select the hosted-source lane.

## Reconnect behavior

Unresolved guest requests retain their request ID.

Identical reconnect retries dedupe.

Reused IDs with different content conflict.

Stale catalog requests are rejected.

## Physical qualification

The host UI captures safe counters for:

- room starts/stops
- peer joins/leaves
- maximum simultaneous peers
- duplicate retries
- stale/conflicting/unknown requests
- join errors
- accepted/refused requests
- linked native effect receipts
- accepted Suno requests

The **FIELD EVIDENCE** panel uses those counters together with the active safe transport profile.

A scenario PASS requires:

1. a human field note describing the physical setup/observation
2. the machine evidence required by that scenario

The export does not include secrets or identifiers.

See [QUALIFICATION.md](QUALIFICATION.md) for the complete nine-scenario procedure.
