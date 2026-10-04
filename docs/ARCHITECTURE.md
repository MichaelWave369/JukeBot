# JukeBot Architecture

JukeBot is built as a music runtime first and a visual jukebox second.

## Native authority

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

Remote guests do not receive a direct Action Bus handle.

## Party request path

```text
Guest
  |
  v
PartyGuestRequest
  |
  v
selected signaling strategy
  |
  v
WebRTC peer
  |
  v
Host Party engine
  |
  +--> dedupe / freshness / source validation
  |
  v
Host ACCEPT / REFUSE
  |
  +--> PartyReceipt
  |
  +--> native -> guest Action Bus -> Reality Ledger
  |
  +--> Suno -> hosted-source selection
```

## Signaling strategies

### Nostr

Default Trystero Nostr matchmaking.

### Controlled WebSocket relay

`@trystero-p2p/ws-relay` with explicit operator-controlled relay URLs.

Controlled mode is fail-closed and does not fall back to Nostr.

## TURN

TURN remains independent of signaling strategy and is used only when direct WebRTC connectivity requires relay assistance.

## Physical qualification boundary

Software correctness and physical network readiness are separate claims.

CI can prove:

- deterministic qualification rules
- safe evidence serialization
- secret exclusion
- controlled relay process health
- protocol invariants
- client build correctness

CI cannot prove:

- two real devices can connect on the operator's LAN
- a cellular client reaches the host
- a real NAT path requires and succeeds through TURN
- multiple physical clients coexist
- physical disconnect/reconnect behavior

Those claims belong to `jukebot.party.qualification.v1`.

## Qualification evidence

Host-side observation counters contain no peer identifiers.

Scenario snapshots contain only:

- signaling strategy
- relay count
- default relay redundancy when applicable
- whether TURN was configured
- TURN server count
- browser capability booleans
- safe aggregate observation counters
- operator notes
- timestamps

They exclude:

- room password
- TURN username/credential
- relay URL
- peer ID
- IP address
- media URL
- media bytes

## Qualification states

```text
FIELD_QUALIFIED
PARTIAL
FAIL
```

A claimed PASS with contradictory machine evidence forces the aggregate result to FAIL.

BLOCKED and NOT_RUN remain PARTIAL.

Only all required PASS outcomes can yield FIELD_QUALIFIED.

## Persistence

Native media and room state use IndexedDB.

Qualification evidence uses a separate browser-local record because it is a test artifact, not authoritative playback state.

Party secrets and live identifiers are never included in portable qualification exports.
