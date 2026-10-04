# JukeBot Architecture

JukeBot is built as a music runtime first and a visual jukebox second.

## Core control flow

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

## Party Room flow

```text
Guest phone
   |
   | PartyGuestRequest
   v
WebRTC data channel
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
   +--> native source -> guest-role Action Bus submission
   |                       |
   |                       v
   |                 Reality Ledger receipt
   |
   +--> Suno source --> hosted-source selection only
```

Network reachability is not authority.

## Party protocol

The wire protocol is versioned as:

```text
jukebot.party.v1
```

Key payloads:

- host snapshot
- guest hello
- guest request
- host decision

A guest request carries:

- unique request ID
- guest display name
- catalog hash
- typed source selection
- creation time

Typed source selections prevent a native track ID and a hosted Suno song ID from collapsing into one ambiguous namespace.

## Safe host snapshot

The host snapshot intentionally contains only requestable metadata.

Native entries expose:

- JukeBot track ID
- title
- artist
- local/url source **type**

They do not expose:

- local Blob URLs
- direct remote audio URLs
- local filenames beyond title metadata
- IndexedDB records

Suno entries expose provider identity metadata needed to request a hosted source selection.

## Request dedupe

The host fingerprints each request ID together with its peer ID, guest name, catalog hash and typed selection.

If the same peer resends the same ID and content after reconnect, the request is treated as a duplicate and the existing record is reused.

If a request ID is reused with different content, the protocol rejects it as a conflict.

This makes reconnect retry behavior idempotent.

## Catalog freshness

Every safe catalog has a stable hash.

A request must reference the hash of the catalog the guest actually saw. If the host library changes before the request arrives, the stale request is rejected rather than silently resolving against a different catalog.

## Host decisions and receipts

Accepted/refused decisions produce Party receipts.

For accepted native media, the host submits:

```text
actor.role = guest
action = ENQUEUE_TRACK
```

through the existing JukeRuntime.

The Party receipt stores the resulting native receipt ID so the host decision can be followed into the Reality Ledger.

For Suno, the Party receipt records acceptance but does not invent a native audio receipt. The accepted request selects the appropriate hosted Suno player.

## P2P transport

`src/party/network.ts` is a transport adapter. The protocol core does not import WebRTC or Trystero.

The current adapter uses Trystero with its default Nostr matchmaking strategy. Once peers connect, JukeBot Party payloads use the browser WebRTC data channel.

The transport is intentionally replaceable. A future LAN/self-hosted relay adapter must carry the same `jukebot.party.v1` messages.

## Invite security boundary

A host creates:

- random room ID
- random room password
- expected host peer ID

The public invite URL puts room ID and host peer ID in query parameters.

The room password is placed in the URL fragment:

```text
...?party=<room>&host=<peer>#key=<secret>
```

Fragments are browser-side invite material and are not part of normal HTTP requests to GitHub Pages.

Guests trust host snapshots/decisions only when they arrive from the peer ID pinned in the invite.

## Native vs hosted audio

### Native audio

JukeBot owns playback and can issue authoritative room receipts.

### Hosted Suno

Suno owns playback inside its iframe. JukeBot may select the hosted item and receipt the host's Party decision, but it does not claim playback-position/song-ended evidence that Suno has not exposed.

## Persistence

IndexedDB v3 owns durable local media, room state, native playlists and Suno source playlists.

Party rooms in v0.5.0 are deliberately ephemeral. Room secrets and live peer IDs are not written into portable session bundles.

## GitHub Pages

The static Pages deployment can still host a real Party Room because the browser transport is peer-to-peer. GitHub Pages serves the app bundle; it is not the Party request server.

## Next boundary

Rung 3C adds optional controlled transport infrastructure such as a self-hosted relay and explicit TURN configuration without changing the Party protocol.
