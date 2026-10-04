import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RoomState, SunoPlaylist } from "../core/types";
import {
  buildPartyInviteUrl,
  clearPartyInviteFromLocation,
  createPartyInvite,
  currentPartyInvite,
} from "../party/invite";
import { createPartyNetwork } from "../party/network";
import type { PartyNetwork } from "../party/network";
import {
  buildPartyCatalog,
  buildPartySnapshot,
  PartyHostEngine,
} from "../party/protocol";
import type {
  PartyCatalogItem,
  PartyDecision,
  PartyGuestRequest,
  PartyHostSnapshot,
  PartyRequestRecord,
  PartySelection,
} from "../party/types";

interface PartyRoomProps {
  room: RoomState;
  sunoPlaylists: SunoPlaylist[];
  onAcceptNative: (
    trackId: string,
    guestName: string,
    peerId: string,
  ) => { receiptId: string } | null;
  onAcceptSuno: (
    playlistId: string | undefined,
    songId: string,
    guestName: string,
    peerId: string,
  ) => boolean;
  onNotice: (message: string) => void;
}

interface HostState {
  roomId: string;
  hostPeerId: string;
  password: string;
  inviteUrl: string;
  qrDataUrl: string;
}

interface GuestDecisionView extends PartyDecision {
  title?: string;
}

function requestId(): string {
  return `req-${crypto.randomUUID()}`;
}

function shortPeer(peerId: string): string {
  return peerId.length > 12 ? `${peerId.slice(0, 8)}…` : peerId;
}

function selectionFor(item: PartyCatalogItem): PartySelection {
  return item.kind === "native"
    ? { kind: "native", trackId: item.trackId }
    : {
        kind: "suno",
        songId: item.songId,
        playlistId: item.playlistId,
      };
}

export function PartyRoom({
  room,
  sunoPlaylists,
  onAcceptNative,
  onAcceptSuno,
  onNotice,
}: PartyRoomProps) {
  const joinInfo = useMemo(() => currentPartyInvite(), []);

  const hostNetworkRef = useRef<PartyNetwork | null>(null);
  const guestNetworkRef = useRef<PartyNetwork | null>(null);
  const hostEngineRef = useRef(new PartyHostEngine());
  const currentRoomRef = useRef(room);
  const currentSunoPlaylistsRef = useRef(sunoPlaylists);
  const guestRequestsRef = useRef(new Map<string, PartyGuestRequest>());
  const guestNamesRef = useRef<Record<string, string>>({});

  const [hostState, setHostState] = useState<HostState | null>(null);
  const [hostPeers, setHostPeers] = useState<string[]>([]);
  const [guestNames, setGuestNames] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PartyRequestRecord[]>([]);
  const [partyLedger, setPartyLedger] = useState(
    () => hostEngineRef.current.ledger(),
  );

  const [guestName, setGuestName] = useState("Guest");
  const [guestConnected, setGuestConnected] = useState(false);
  const [guestSnapshot, setGuestSnapshot] =
    useState<PartyHostSnapshot | null>(null);
  const [guestDecisions, setGuestDecisions] = useState<GuestDecisionView[]>([]);
  const [guestPendingIds, setGuestPendingIds] = useState<string[]>([]);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestFilter, setGuestFilter] = useState("");

  useEffect(() => {
    currentRoomRef.current = room;
    currentSunoPlaylistsRef.current = sunoPlaylists;
  }, [room, sunoPlaylists]);

  function syncHostEngineView() {
    setPending(hostEngineRef.current.pending());
    setPartyLedger(hostEngineRef.current.ledger());
  }

  function hostSnapshot(peerId: string): PartyHostSnapshot {
    return buildPartySnapshot(room, sunoPlaylists, peerId);
  }

  async function startHost() {
    if (hostNetworkRef.current) return;

    const provisional = createPartyInvite("pending");
    let network: PartyNetwork | null = null;

    network = createPartyNetwork(
      provisional.roomId,
      provisional.password,
      {
        onPeerJoin: (peerId) => {
          setHostPeers((current) =>
            current.includes(peerId) ? current : [...current, peerId],
          );

          if (network) {
            void network.sendSnapshot(
              buildPartySnapshot(
                currentRoomRef.current,
                currentSunoPlaylistsRef.current,
                network.selfPeerId,
              ),
              peerId,
            );
          }
        },
        onPeerLeave: (peerId) => {
          setHostPeers((current) => current.filter((id) => id !== peerId));
          const nextNames = { ...guestNamesRef.current };
          delete nextNames[peerId];
          guestNamesRef.current = nextNames;
          setGuestNames(nextNames);
        },
        onGuestHello: (hello, peerId) => {
          if (hello.protocol !== "jukebot.party.v1") return;
          const clean = hello.guestName.trim().slice(0, 40) || "Guest";
          guestNamesRef.current = {
            ...guestNamesRef.current,
            [peerId]: clean,
          };
          setGuestNames(guestNamesRef.current);
        },
        onGuestRequest: (request, peerId) => {
          if (request.protocol !== "jukebot.party.v1") return;

          const canonicalRequest: PartyGuestRequest = {
            ...request,
            guestName:
              guestNamesRef.current[peerId] ??
              request.guestName.trim().slice(0, 40) ??
              "Guest",
          };

          const result = hostEngineRef.current.ingest(
            canonicalRequest,
            peerId,
            buildPartyCatalog(
              currentRoomRef.current,
              currentSunoPlaylistsRef.current,
            ),
          );

          if (result.status === "new" || result.status === "duplicate") {
            syncHostEngineView();

            if (result.status === "duplicate" && result.record.decision && network) {
              void network.sendDecision(result.record.decision, peerId);
            }
            return;
          }

          const reason = result.reason;
          const refusal: PartyDecision = {
            protocol: "jukebot.party.v1",
            requestId: canonicalRequest.requestId,
            decision: "refused",
            reason,
            receiptId: `protocol-${canonicalRequest.requestId}`,
            decidedAt: new Date().toISOString(),
          };
          if (network) void network.sendDecision(refusal, peerId);
        },
        onJoinError: (message) => {
          onNotice(`Party transport warning: ${message}`);
        },
      },
    );

    const invite = {
      ...provisional,
      hostPeerId: network.selfPeerId,
    };

    hostNetworkRef.current = network;

    const inviteUrl = buildPartyInviteUrl(
      invite,
      `${window.location.origin}${window.location.pathname}`,
    );

    const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    setHostState({
      roomId: invite.roomId,
      hostPeerId: invite.hostPeerId,
      password: invite.password,
      inviteUrl,
      qrDataUrl,
    });
    setHostPeers(network.peerIds());

    onNotice("Party Room host is live; scan the QR from another device");
  }

  function stopHost() {
    hostNetworkRef.current?.leave();
    hostNetworkRef.current = null;
    hostEngineRef.current = new PartyHostEngine();
    setHostState(null);
    setHostPeers([]);
    guestNamesRef.current = {};
    setGuestNames({});
    setPending([]);
    setPartyLedger([]);
    onNotice("Party Room host stopped");
  }

  async function copyInvite() {
    if (!hostState) return;
    await navigator.clipboard.writeText(hostState.inviteUrl);
    onNotice("Party invite copied");
  }

  async function connectGuest() {
    if (!joinInfo || guestNetworkRef.current) return;

    let network: PartyNetwork | null = null;

    network = createPartyNetwork(joinInfo.roomId, joinInfo.password, {
      onPeerJoin: (peerId) => {
        if (peerId !== joinInfo.hostPeerId || !network) return;

        setGuestConnected(true);
        setGuestError(null);
        void network.sendGuestHello(
          {
            protocol: "jukebot.party.v1",
            guestName: guestName.trim().slice(0, 40) || "Guest",
            sentAt: new Date().toISOString(),
          },
          joinInfo.hostPeerId,
        );

        for (const pendingRequest of guestRequestsRef.current.values()) {
          void network.sendGuestRequest(pendingRequest, joinInfo.hostPeerId);
        }
      },
      onPeerLeave: (peerId) => {
        if (peerId === joinInfo.hostPeerId) {
          setGuestConnected(false);
          setGuestError("Host disconnected");
        }
      },
      onSnapshot: (snapshot, peerId) => {
        if (peerId !== joinInfo.hostPeerId) return;
        if (
          snapshot.protocol !== "jukebot.party.v1" ||
          snapshot.hostPeerId !== joinInfo.hostPeerId
        ) {
          return;
        }
        setGuestSnapshot(snapshot);
        setGuestConnected(true);
      },
      onDecision: (decision, peerId) => {
        if (peerId !== joinInfo.hostPeerId) return;
        guestRequestsRef.current.delete(decision.requestId);
        setGuestPendingIds((current) =>
          current.filter((id) => id !== decision.requestId),
        );
        setGuestDecisions((current) => [
          { ...decision },
          ...current.filter((item) => item.requestId !== decision.requestId),
        ].slice(0, 20));
      },
      onJoinError: (message) => {
        setGuestError(message);
        setGuestConnected(false);
      },
    });

    guestNetworkRef.current = network;

    if (network.peerIds().includes(joinInfo.hostPeerId)) {
      setGuestConnected(true);
      await network.sendGuestHello(
        {
          protocol: "jukebot.party.v1",
          guestName: guestName.trim().slice(0, 40) || "Guest",
          sentAt: new Date().toISOString(),
        },
        joinInfo.hostPeerId,
      );
    }
  }

  function disconnectGuest() {
    guestNetworkRef.current?.leave();
    guestNetworkRef.current = null;
    setGuestConnected(false);
    setGuestSnapshot(null);
    guestRequestsRef.current.clear();
    setGuestPendingIds([]);
    setGuestDecisions([]);
    setGuestError(null);
  }

  function exitGuestMode() {
    disconnectGuest();
    clearPartyInviteFromLocation();
    window.location.reload();
  }

  async function requestItem(item: PartyCatalogItem) {
    if (!joinInfo || !guestNetworkRef.current || !guestSnapshot) return;

    const id = requestId();
    const request: PartyGuestRequest = {
      protocol: "jukebot.party.v1",
      requestId: id,
      guestName: guestName.trim().slice(0, 40) || "Guest",
      catalogHash: guestSnapshot.catalogHash,
      selection: selectionFor(item),
      sentAt: new Date().toISOString(),
    };

    guestRequestsRef.current.set(id, request);
    setGuestPendingIds((current) => [...current, id]);

    try {
      await guestNetworkRef.current.sendGuestRequest(
        request,
        joinInfo.hostPeerId,
      );
    } catch (error) {
      guestRequestsRef.current.delete(id);
      setGuestPendingIds((current) => current.filter((value) => value !== id));
      setGuestError(
        error instanceof Error ? error.message : "Could not send request",
      );
    }
  }

  async function decideRequest(
    record: PartyRequestRecord,
    accepted: boolean,
  ) {
    const network = hostNetworkRef.current;
    if (!network) return;

    let effectReceiptId: string | undefined;
    let decisionAccepted = accepted;
    let reason: string | undefined;

    if (accepted) {
      if (record.request.selection.kind === "native") {
        const effect = onAcceptNative(
          record.request.selection.trackId,
          record.request.guestName,
          record.peerId,
        );

        if (!effect) {
          decisionAccepted = false;
          reason = "Native track is no longer available";
        } else {
          effectReceiptId = effect.receiptId;
        }
      } else {
        const ok = onAcceptSuno(
          record.request.selection.playlistId,
          record.request.selection.songId,
          record.request.guestName,
          record.peerId,
        );

        if (!ok) {
          decisionAccepted = false;
          reason = "Suno source is no longer available";
        }
      }
    } else {
      reason = "Host declined the request";
    }

    const decision = hostEngineRef.current.decide(
      record.request.requestId,
      decisionAccepted ? "accepted" : "refused",
      {
        reason,
        effectReceiptId,
      },
    );

    syncHostEngineView();
    await network.sendDecision(decision, record.peerId);

    const snapshot = hostSnapshot(network.selfPeerId);
    await network.sendSnapshot(snapshot);
  }

  useEffect(() => {
    const network = hostNetworkRef.current;
    if (!network || !hostState) return;

    void network.sendSnapshot(
      buildPartySnapshot(room, sunoPlaylists, network.selfPeerId),
    );
  }, [hostState, room, sunoPlaylists]);

  useEffect(() => {
    return () => {
      hostNetworkRef.current?.leave();
      guestNetworkRef.current?.leave();
    };
  }, []);

  const guestCatalog = useMemo(() => {
    const catalog = guestSnapshot?.catalog ?? [];
    const needle = guestFilter.trim().toLowerCase();
    if (!needle) return catalog;

    return catalog.filter((item) => {
      const extra =
        item.kind === "native"
          ? item.artist ?? ""
          : item.playlistName;
      return `${item.title} ${extra}`.toLowerCase().includes(needle);
    });
  }, [guestFilter, guestSnapshot]);

  if (joinInfo) {
    return (
      <section className="panel party-room guest-mode">
        <div className="panel-head party-head">
          <div>
            <p className="eyebrow">PARTY ROOM / GUEST</p>
            <h3>REQUEST A TRACK</h3>
          </div>
          <div className="party-status">
            <span className={guestConnected ? "connected" : "waiting"}>
              {guestConnected ? "HOST CONNECTED" : "WAITING FOR HOST"}
            </span>
            <button onClick={exitGuestMode}>EXIT PARTY</button>
          </div>
        </div>

        <div className="guest-join">
          <label>
            YOUR NAME
            <input
              value={guestName}
              maxLength={40}
              onChange={(event) => setGuestName(event.target.value)}
              disabled={guestConnected}
            />
          </label>

          {!guestNetworkRef.current ? (
            <button onClick={() => void connectGuest()}>JOIN PARTY</button>
          ) : (
            <button onClick={disconnectGuest}>DISCONNECT</button>
          )}

          <small>
            Host {shortPeer(joinInfo.hostPeerId)} · room {joinInfo.roomId.slice(0, 8)}
          </small>
        </div>

        {guestError ? <p className="party-error">{guestError}</p> : null}

        {guestSnapshot ? (
          <>
            <div className="guest-room-state">
              <div>
                <span>NOW</span>
                <strong>{guestSnapshot.nowPlaying?.title ?? "Nothing playing"}</strong>
              </div>
              <div>
                <span>QUEUE</span>
                <strong>{guestSnapshot.queue.length}</strong>
              </div>
              <div>
                <span>CATALOG</span>
                <strong>{guestSnapshot.catalog.length}</strong>
              </div>
            </div>

            <input
              className="search-input party-search"
              value={guestFilter}
              onChange={(event) => setGuestFilter(event.target.value)}
              placeholder="Search host catalog"
            />

            <div className="party-catalog">
              {guestCatalog.map((item) => (
                <div className="party-catalog-item" key={
                  item.kind === "native"
                    ? `native-${item.trackId}`
                    : `suno-${item.playlistId}-${item.songId}`
                }>
                  <div>
                    <strong>{item.title}</strong>
                    <small>
                      {item.kind === "native"
                        ? `NATIVE · ${item.artist ?? item.sourceType.toUpperCase()}`
                        : `SUNO · ${item.playlistName}`}
                    </small>
                  </div>
                  <button
                    disabled={!guestConnected}
                    onClick={() => void requestItem(item)}
                  >
                    REQUEST
                  </button>
                </div>
              ))}
            </div>

            {guestPendingIds.length ? (
              <p className="party-pending">
                {guestPendingIds.length} request{guestPendingIds.length === 1 ? "" : "s"} awaiting host
              </p>
            ) : null}

            {guestDecisions.length ? (
              <div className="party-decisions">
                <div className="panel-head mini">
                  <h3>HOST DECISIONS</h3>
                  <span>{guestDecisions.length}</span>
                </div>
                {guestDecisions.map((decision) => (
                  <div
                    className={`party-decision ${decision.decision}`}
                    key={decision.requestId}
                  >
                    <strong>{decision.decision.toUpperCase()}</strong>
                    <span>{decision.reason ?? "Request approved"}</span>
                    <code>{decision.receiptId}</code>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="empty">
            Join the room to receive the host&apos;s requestable catalog.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="panel party-room">
      <div className="panel-head party-head">
        <div>
          <p className="eyebrow">PARTY ROOM / HOST AUTHORITY</p>
          <h3>PHONE REQUESTS</h3>
        </div>
        <span>{hostPeers.length} PEER{hostPeers.length === 1 ? "" : "S"}</span>
      </div>

      {!hostState ? (
        <div className="party-start">
          <div>
            <strong>Open a private request room.</strong>
            <p>
              Guests scan a QR, browse a safe catalog, and submit requests. Nothing
              touches playback until the host accepts it.
            </p>
          </div>
          <button onClick={() => void startHost()}>START PARTY ROOM</button>
        </div>
      ) : (
        <>
          <div className="party-host-grid">
            <div className="party-qr">
              <img src={hostState.qrDataUrl} alt="JukeBot Party Room invite QR code" />
              <div>
                <strong>SCAN TO JOIN</strong>
                <small>Room {hostState.roomId.slice(0, 8)}</small>
              </div>
            </div>

            <div className="party-invite">
              <label>
                INVITE LINK
                <input readOnly value={hostState.inviteUrl} />
              </label>
              <div className="row-actions">
                <button onClick={() => void copyInvite()}>COPY INVITE</button>
                <button className="danger" onClick={stopHost}>STOP ROOM</button>
              </div>
              <p className="source-note">
                The room key lives in the URL fragment. JukeBot does not put it in
                GitHub Pages requests or the shared catalog.
              </p>
            </div>
          </div>

          <div className="party-peers">
            <div className="panel-head mini">
              <h3>CONNECTED GUESTS</h3>
              <span>{hostPeers.length}</span>
            </div>
            {hostPeers.length ? (
              <div className="tag-row">
                {hostPeers.map((peerId) => (
                  <span className="tag" key={peerId}>
                    {guestNames[peerId] ?? "Guest"} · {shortPeer(peerId)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="empty">Nobody has scanned the invite yet.</p>
            )}
          </div>

          <div className="party-requests">
            <div className="panel-head mini">
              <h3>PENDING REQUESTS</h3>
              <span>{pending.length}</span>
            </div>

            {pending.length ? (
              pending.map((record) => (
                <div className="party-request" key={record.request.requestId}>
                  <div>
                    <strong>{record.resolvedTitle}</strong>
                    <small>
                      {record.request.guestName} · {record.request.selection.kind.toUpperCase()}
                    </small>
                  </div>
                  <div className="row-actions">
                    <button onClick={() => void decideRequest(record, true)}>
                      ACCEPT
                    </button>
                    <button
                      className="danger"
                      onClick={() => void decideRequest(record, false)}
                    >
                      REFUSE
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty">No requests waiting for the host.</p>
            )}
          </div>

          <div className="party-ledger">
            <div className="panel-head mini">
              <h3>PARTY RECEIPTS</h3>
              <span>{partyLedger.length}</span>
            </div>

            {partyLedger.length ? (
              [...partyLedger].reverse().map((receipt) => (
                <div
                  className={`party-decision ${receipt.decision}`}
                  key={receipt.receiptId}
                >
                  <strong>{receipt.decision.toUpperCase()} · {receipt.resolvedTitle}</strong>
                  <span>{receipt.guestName}</span>
                  <code>
                    {receipt.effectReceiptId
                      ? `${receipt.receiptId} → ${receipt.effectReceiptId}`
                      : receipt.receiptId}
                  </code>
                </div>
              ))
            ) : (
              <p className="empty">No host decisions yet.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
