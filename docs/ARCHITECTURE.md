# JukeBot Architecture

JukeBot is built as a music runtime first and a visual jukebox second.

## Native authority path

```text
Human / DJ / Agent / Script
          |
          v
     ActionEnvelope
          |
          v
       Authority
          |
          v
 deterministic native room
          |
          v
   Reality Ledger
```

Remote guests do not get a direct Action Bus handle.

## Party request path

```text
Guest
  |
  v
PartyGuestRequest
  |
  v
signaling-selected WebRTC peer
  |
  v
Host Party engine
  |
  +--> dedupe / catalog / source validation
  |
  v
Host ACCEPT / REFUSE
  |
  +--> PartyReceipt
  |
  +--> native -> guest-role Action Bus -> Reality Ledger
  |
  +--> Suno -> hosted-source selection
```

## Signaling strategy boundary

`src/party/network.ts` supports two strategies behind the same Party protocol.

### Nostr

```text
trystero
  -> Nostr signaling
  -> WebRTC
```

Nostr is the default.

### Controlled WebSocket relay

```text
@trystero-p2p/ws-relay
  -> operator-controlled WebSocket signaling
  -> WebRTC
```

Controlled mode requires explicit relay URLs.

There is no silent fallback from controlled mode to Nostr.

The transport profile travels in the Party invite fragment so host and guest select the same strategy.

## Controlled relay service

`relay/server.mjs` uses the official `createWsRelayServer` server boundary.

The service:

- attaches WebSocket signaling to a Node HTTP server
- exposes `/healthz`
- exposes `/status`
- applies bounded topic/subscription defaults
- supports graceful SIGINT/SIGTERM shutdown

The relay transports signaling topics, not JukeBot media.

## TURN boundary

TURN remains independent of signaling strategy.

A signaling relay answers "how do peers exchange connection information?"

TURN answers "what if those peers cannot establish a direct network path?"

Both Nostr and controlled WebSocket signaling can be combined with the same TURN profile.

## Safe catalog

Guests receive requestable metadata only.

Native media source URLs, IndexedDB Blob URLs and host-private media bytes are not exposed through the Party catalog.

## Request idempotency

Each request has a stable request ID and catalog hash.

Reconnect retries reuse the same request envelope. Identical retries dedupe; conflicting reuse is rejected.

## Persistence

Party room secrets, peer IDs, TURN credentials and signaling profiles are ephemeral.

They are not written into portable JukeBot session bundles.

## Validation

The CI gate validates:

- deterministic runtime
- portable replay
- Suno source parsing
- Party protocol/transport profile rules
- controlled relay process boot
- relay health/status responses
- clean relay shutdown
- TypeScript
- production client build

## Next boundary

Rung 3C3 moves from software qualification to physical network qualification across real browsers, devices and NAT paths.
