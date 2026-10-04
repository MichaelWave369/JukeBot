# Party Room

Party Room turns the live GitHub Pages JukeBot into a cross-device request room without giving guests playback authority.

## Normal host flow

1. Open JukeBot on the playback/library device.
2. Expand **TRANSPORT PROFILE** if you need custom networking.
3. Press **START PARTY ROOM**.
4. Show the QR code or copy the invite link.
5. Guests scan the invite and request tracks.
6. Accept or refuse each request.

The default transport profile requires no configuration.

## Default networking

JukeBot uses Trystero's default Nostr matchmaking strategy to discover peers and WebRTC data channels for Party messages.

The transport diagnostics show:

- secure browser context
- WebRTC availability
- Web Crypto availability
- WebSocket availability
- browser online state
- signaling profile
- TURN fallback status

A yellow TURN badge is not a failure. It means direct WebRTC is being attempted without a configured relay fallback.

## Custom Nostr relays

The host may supply one or more secure WebSocket relay URLs:

```text
wss://relay-one.example
wss://relay-two.example
```

When custom relay URLs are present, JukeBot passes the entire list to Trystero instead of default relay redundancy.

Without custom URLs, the host can tune default relay redundancy from 1 through 10.

Invalid/non-WebSocket URLs are discarded by profile normalization.

## TURN fallback

For restrictive NAT/firewall networks, the host can add TURN:

```text
turns:turn.example.com:5349
```

with optional username and credential.

The normalized TURN profile is passed to Trystero, which keeps its normal STUN behavior while adding the supplied TURN servers.

### Credential rule

TURN credentials entered in the UI are:

- session-only
- not written to IndexedDB
- not written to JukeBot session bundles
- not committed to GitHub
- not placed in normal URL query parameters

They are included in the Party invite fragment so the guest receives the same network profile automatically.

That makes the feature appropriate for **ephemeral/time-limited TURN credentials**.

Do not use a long-lived administrative TURN password in a Party invite.

## Invite format

Default invite:

```text
https://michaelwave369.github.io/JukeBot/
?party=<room-id>&host=<host-peer-id>
#key=<room-password>
```

Custom transport invite:

```text
...?party=<room>&host=<host>
#key=<room-password>&net=<base64url-transport-profile>
```

The fragment stays browser-side during the ordinary GitHub Pages HTTP request.

## Join failure guidance

JukeBot classifies common connection errors.

ICE/WebRTC/timeout-style failures are surfaced as likely direct-connect problems and recommend an ephemeral TURN profile.

Password/handshake failures recommend re-scanning the active QR.

Offline/network failures recommend restoring connectivity before reconnecting.

## Authority remains unchanged

Transport settings alter reachability, not authority.

A successful WebRTC connection does not grant a guest play, pause, skip, volume, crate, metadata or delete privileges.

Accepted native requests still enter the ordinary Action Bus as a `guest` actor.

Accepted Suno requests still select the hosted-source lane only.

## Reconnect behavior

Unresolved requests retain their original request IDs. Reconnect retries therefore dedupe instead of creating duplicate pending requests.

## Next qualification

Rung 3C2 adds an optional self-hosted WebSocket signaling adapter.

Rung 3C3 then physically qualifies LAN/WAN/mobile/TURN behavior across real devices and restrictive network conditions.
