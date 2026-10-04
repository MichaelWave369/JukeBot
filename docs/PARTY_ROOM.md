# Party Room

Party Room turns the live GitHub Pages JukeBot into a cross-device request room without giving guests playback authority.

## Host

1. Open JukeBot on the device that owns the library and playback.
2. Press **START PARTY ROOM**.
3. Show the QR code or copy the invite link.
4. Leave the host page open.
5. Guests scan the invite and request tracks.
6. Review each pending request.
7. Press **ACCEPT** or **REFUSE**.

Accepted native requests enter the ordinary Action Bus as a `guest` actor.

Accepted Suno requests select the requested hosted Suno song in the Suno Deck.

## Guest

1. Scan the host QR code.
2. Enter a display name.
3. Press **JOIN PARTY**.
4. Browse/search the safe host catalog.
5. Press **REQUEST** on a native or Suno item.
6. Wait for the host decision.

Guests never receive play, pause, skip, volume or crate-edit authority.

## What the guest catalog contains

Native entries:

- JukeBot track ID
- title
- artist
- source type (`local` or `url`)

Suno entries:

- Suno song UUID
- title
- JukeBot Suno playlist ID/name

The safe catalog does not expose native audio URLs.

That includes both:

- temporary local `blob:` URLs
- direct playable remote URLs held by the host

## Reconnect behavior

Each guest request has a unique request ID.

If a guest temporarily loses the host connection while a request is unresolved, JukeBot keeps the original request envelope and resends the same ID when the host peer reconnects.

The host treats an identical resend as a duplicate and reuses the original request record.

A reused request ID with different content is rejected.

## Catalog freshness

Requests include the hash of the catalog snapshot used by the guest.

If the host's catalog changes before the request arrives, that request is rejected as stale. The guest then receives the next host snapshot and can request from the current catalog.

This prevents a stale ID from accidentally resolving to a different source state.

## Party receipts

The host's accept/refuse decision creates a Party receipt.

For native media, an accepted Party receipt includes the Reality Ledger receipt ID created when the guest-role `ENQUEUE_TRACK` action is accepted by JukeRuntime.

For hosted Suno media, a Party receipt records the host decision and source identity. It does not fabricate native audio evidence for the provider-hosted iframe.

## Invite format

An invite resembles:

```text
https://michaelwave369.github.io/JukeBot/?party=<room-id>&host=<host-peer-id>#key=<room-password>
```

The room ID and expected host peer ID are routing/identity information.

The room password is in the URL fragment so it remains browser-side during the normal GitHub Pages HTTP request.

Do not post live Party invite links publicly unless you actually want strangers in that request room.

## Network model

The current transport uses Trystero's default Nostr matchmaking strategy and WebRTC peer connections.

Trystero handles peer discovery/signaling. Once a peer connection exists, Party protocol messages move over WebRTC data channels.

Party protocol logic is separate from the transport implementation. A future self-hosted relay or LAN-oriented adapter can carry the same messages.

## Network caveats

Peer-to-peer WebRTC can fail on restrictive NAT/firewall networks.

Rung 3C is reserved for deployment hardening:

- configurable TURN service
- optional self-hosted Trystero WebSocket relay
- LAN-oriented transport/discovery
- connection diagnostics
- explicit relay policy controls

The Party protocol does not need to change for those additions.
