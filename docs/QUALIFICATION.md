# JukeBot Party Physical Network Qualification

Rung 3C3 converts Party Room readiness from an assumption into an evidence-backed field result.

The live host UI contains a **FIELD EVIDENCE** panel with nine required scenarios.

Overall results are:

- `FIELD_QUALIFIED` — every required scenario is PASS with matching machine evidence
- `PARTIAL` — no contradiction/failure exists, but one or more scenarios remain NOT_RUN or BLOCKED
- `FAIL` — any scenario is FAIL or a claimed PASS contradicts captured machine evidence

## Evidence privacy

Qualification evidence intentionally excludes:

- Party room passwords
- TURN usernames and credentials
- relay URLs
- peer IDs
- local IP addresses
- local media URLs
- Suno URLs
- media bytes

The export stores safe counts and state such as:

- signaling strategy
- relay count
- whether TURN was configured
- browser capability booleans
- room starts/stops
- peer join/leave counts
- maximum simultaneous peers
- duplicate retry count
- linked native receipt count
- accepted Suno request count
- scenario notes and timestamps

## How to run a qualification session

1. Open JukeBot on the host PC.
2. Open **Rung 3C3 / Physical Network Qualification**.
3. Press **NEW SESSION**.
4. Run each scenario below.
5. Enter a short physical note describing the devices/network used and what happened.
6. Press PASS only after the UI enables it.
7. Use FAIL when the behavior is wrong.
8. Use BLOCKED when the scenario cannot currently be exercised.
9. Press **EXPORT EVIDENCE** when finished.

A PASS button stays disabled until both a field note and the required machine evidence are present.

## Required scenarios

### 1. Same-LAN Nostr

- host: PC
- guest: separate physical phone/tablet/laptop
- signaling: Nostr
- network: same local network

Acceptance:

- guest joins
- safe catalog arrives
- guest submits a request
- host sees the request

### 2. Cellular / WAN Nostr

- host remains on its normal Internet path
- disable Wi-Fi on the guest phone
- guest uses cellular/WAN
- signaling: Nostr

Acceptance:

- fresh invite joins successfully
- guest receives catalog
- request reaches host

Record the physical network distinction in the note. A web page cannot independently prove that a phone is using cellular.

### 3. Controlled WebSocket Relay

- deploy/run the included relay
- choose **CONTROLLED WS RELAY**
- use the deployed ws/wss endpoint
- join from a physical guest

Acceptance:

- controlled strategy is captured
- at least one guest joins
- request round trip succeeds
- no Nostr fallback is used

### 4. TURN Fallback

Configure ephemeral TURN credentials and exercise a path where direct WebRTC is unavailable or intentionally restricted.

Acceptance:

- TURN is present in the captured profile
- guest joins
- Party request path succeeds

Record how direct connectivity was restricted in the note.

### 5. Disconnect / Reconnect Idempotency

1. Join guest.
2. Submit a request.
3. Interrupt the guest connection before the host resolves the request.
4. Restore the connection.
5. Allow the guest to resend the unresolved request.

Acceptance:

- at least one peer leave
- at least two peer joins across the run
- duplicate request retry observed
- host does not receive a second independent pending request

### 6. Multiple Simultaneous Guests

Join at least two physical guest clients concurrently.

Acceptance:

- host reaches `MAX PEERS >= 2`
- both guests can submit distinguishable requests

### 7. Native Reality Ledger Link

Request a native JukeBot track and ACCEPT it on the host.

Acceptance:

- Party receipt accepted
- native Action Bus accepts the guest-role request
- Party receipt links to the resulting Reality Ledger receipt
- `NATIVE LINKS >= 1`

### 8. Suno Hosted Source Lane

Request a persisted Suno source and ACCEPT it.

Acceptance:

- requested Suno selection is activated
- `SUNO ACCEPTS >= 1`
- JukeBot does not fabricate a native playback receipt for the provider-hosted player

### 9. Host Stop / Restart / Rejoin

1. Start a Party Room and join a guest.
2. Stop the Party Room.
3. Start a new Party Room.
4. Scan the new invite and join again.

Acceptance:

- at least two room starts
- at least one room stop
- at least two peer joins across the run

## Evidence export

The exported schema is:

```text
jukebot.party.qualification.v1
```

On import/parsing, the overall qualification state is recomputed from scenario evidence rather than trusted from the file's claimed `overall` field.

## Qualification boundary

CI can validate the qualification engine, privacy rules and consistency checks.

CI cannot claim physical network qualification.

Only a completed field session with the required real-device scenarios can produce `FIELD_QUALIFIED`.
