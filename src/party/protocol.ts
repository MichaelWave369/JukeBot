import { stableHash } from "../core/hash";
import type { RoomState, SunoPlaylist } from "../core/types";
import type {
  PartyCatalogItem,
  PartyDecision,
  PartyDecisionKind,
  PartyGuestRequest,
  PartyHostSnapshot,
  PartyReceipt,
  PartyRequestRecord,
  PartySelection,
} from "./types";

export interface PartyCatalog {
  hash: string;
  items: PartyCatalogItem[];
}

export type IngestResult =
  | { status: "new"; record: PartyRequestRecord }
  | { status: "duplicate"; record: PartyRequestRecord }
  | { status: "conflict"; reason: string }
  | { status: "stale"; reason: string }
  | { status: "unknown"; reason: string };

function catalogItemKey(item: PartyCatalogItem): string {
  return item.kind === "native"
    ? `native:${item.trackId}`
    : `suno:${item.playlistId}:${item.songId}`;
}

function selectionKey(selection: PartySelection): string {
  return selection.kind === "native"
    ? `native:${selection.trackId}`
    : `suno:${selection.playlistId ?? "*"}:${selection.songId}`;
}

export function buildPartyCatalog(
  room: RoomState,
  sunoPlaylists: SunoPlaylist[],
): PartyCatalog {
  const nativeItems: PartyCatalogItem[] = Object.values(room.tracks)
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((track) => ({
      kind: "native",
      trackId: track.id,
      title: track.title,
      artist: track.artist,
      sourceType: track.sourceType,
    }));

  const sunoItems: PartyCatalogItem[] = sunoPlaylists
    .flatMap((playlist) =>
      playlist.tracks.map((track) => ({
        kind: "suno" as const,
        songId: track.songId,
        title: track.title,
        playlistId: playlist.id,
        playlistName: playlist.name,
      })),
    )
    .sort((a, b) =>
      `${a.playlistName}\u0000${a.title}`.localeCompare(
        `${b.playlistName}\u0000${b.title}`,
      ),
    );

  const items = [...nativeItems, ...sunoItems];

  return {
    hash: stableHash(
      items.map((item) => ({
        key: catalogItemKey(item),
        title: item.title,
        artist: item.kind === "native" ? item.artist : undefined,
        playlistName: item.kind === "suno" ? item.playlistName : undefined,
      })),
    ),
    items,
  };
}

export function buildPartySnapshot(
  room: RoomState,
  sunoPlaylists: SunoPlaylist[],
  hostPeerId: string,
  now = new Date().toISOString(),
): PartyHostSnapshot {
  const catalog = buildPartyCatalog(room, sunoPlaylists);

  return {
    protocol: "jukebot.party.v1",
    hostPeerId,
    roomSeq: room.seq,
    catalogHash: catalog.hash,
    catalog: catalog.items,
    queue: room.queue.map((trackId) => ({
      trackId,
      title: room.tracks[trackId]?.title ?? "Unavailable track",
    })),
    nowPlaying: room.currentTrackId
      ? {
          trackId: room.currentTrackId,
          title: room.tracks[room.currentTrackId]?.title ?? "Unavailable track",
        }
      : undefined,
    sentAt: now,
  };
}

function resolveSelection(
  selection: PartySelection,
  catalog: PartyCatalogItem[],
): PartyCatalogItem | null {
  if (selection.kind === "native") {
    return (
      catalog.find(
        (item) =>
          item.kind === "native" && item.trackId === selection.trackId,
      ) ?? null
    );
  }

  return (
    catalog.find(
      (item) =>
        item.kind === "suno" &&
        item.songId === selection.songId &&
        (!selection.playlistId || item.playlistId === selection.playlistId),
    ) ?? null
  );
}

function requestFingerprint(request: PartyGuestRequest, peerId: string): string {
  return stableHash({
    peerId,
    requestId: request.requestId,
    guestName: request.guestName,
    catalogHash: request.catalogHash,
    selection: request.selection,
  });
}

export class PartyHostEngine {
  private readonly records = new Map<string, PartyRequestRecord>();
  private readonly fingerprints = new Map<string, string>();
  private readonly receipts: PartyReceipt[] = [];

  ingest(
    request: PartyGuestRequest,
    peerId: string,
    catalog: PartyCatalog,
    receivedAt = new Date().toISOString(),
  ): IngestResult {
    const fingerprint = requestFingerprint(request, peerId);
    const existing = this.records.get(request.requestId);

    if (existing) {
      if (this.fingerprints.get(request.requestId) !== fingerprint) {
        return {
          status: "conflict",
          reason: "Request ID was reused with different content",
        };
      }
      return { status: "duplicate", record: existing };
    }

    if (request.catalogHash !== catalog.hash) {
      return {
        status: "stale",
        reason: "Guest catalog snapshot is stale; refresh before requesting",
      };
    }

    const item = resolveSelection(request.selection, catalog.items);
    if (!item) {
      return {
        status: "unknown",
        reason: "Requested source is not present in the host catalog",
      };
    }

    const record: PartyRequestRecord = {
      request,
      peerId,
      resolvedTitle: item.title,
      status: "pending",
      receivedAt,
    };

    this.records.set(request.requestId, record);
    this.fingerprints.set(request.requestId, fingerprint);

    return { status: "new", record };
  }

  pending(): PartyRequestRecord[] {
    return [...this.records.values()]
      .filter((record) => record.status === "pending")
      .sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  }

  all(): PartyRequestRecord[] {
    return [...this.records.values()].sort((a, b) =>
      a.receivedAt.localeCompare(b.receivedAt),
    );
  }

  ledger(): PartyReceipt[] {
    return [...this.receipts];
  }

  decide(
    requestId: string,
    decision: PartyDecisionKind,
    options: {
      reason?: string;
      effectReceiptId?: string;
      decidedAt?: string;
    } = {},
  ): PartyDecision {
    const record = this.records.get(requestId);
    if (!record) throw new Error("Unknown party request");

    if (record.decision) return record.decision;

    const decidedAt = options.decidedAt ?? new Date().toISOString();
    const receiptId = stableHash({
      requestId,
      peerId: record.peerId,
      guestName: record.request.guestName,
      selectionKey: selectionKey(record.request.selection),
      decision,
      reason: options.reason,
      effectReceiptId: options.effectReceiptId,
      catalogHash: record.request.catalogHash,
      decidedAt,
    });

    const partyReceipt: PartyReceipt = {
      receiptId,
      requestId,
      peerId: record.peerId,
      guestName: record.request.guestName,
      selection: record.request.selection,
      resolvedTitle: record.resolvedTitle,
      decision,
      reason: options.reason,
      catalogHash: record.request.catalogHash,
      decidedAt,
      effectReceiptId: options.effectReceiptId,
    };

    const partyDecision: PartyDecision = {
      protocol: "jukebot.party.v1",
      requestId,
      decision,
      reason: options.reason,
      receiptId,
      decidedAt,
      effectReceiptId: options.effectReceiptId,
    };

    record.status = decision;
    record.decision = partyDecision;
    this.receipts.push(partyReceipt);

    return partyDecision;
  }
}
