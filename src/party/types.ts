export type PartySourceKind = "native" | "suno";

export interface PartyTurnServer {
  urls: string[];
  username?: string;
  credential?: string;
}

export interface PartyTransportProfile {
  version: 1;
  relayUrls?: string[];
  relayRedundancy?: number;
  turn?: PartyTurnServer[];
}

export interface PartyNativeCatalogItem {
  kind: "native";
  trackId: string;
  title: string;
  artist?: string;
  sourceType: "local" | "url";
}

export interface PartySunoCatalogItem {
  kind: "suno";
  songId: string;
  title: string;
  playlistId: string;
  playlistName: string;
}

export type PartyCatalogItem = PartyNativeCatalogItem | PartySunoCatalogItem;

export interface PartyQueueItem {
  trackId: string;
  title: string;
}

export interface PartyHostSnapshot {
  protocol: "jukebot.party.v1";
  hostPeerId: string;
  roomSeq: number;
  catalogHash: string;
  catalog: PartyCatalogItem[];
  queue: PartyQueueItem[];
  nowPlaying?: PartyQueueItem;
  sentAt: string;
}

export interface PartyGuestHello {
  protocol: "jukebot.party.v1";
  guestName: string;
  sentAt: string;
}

export type PartySelection =
  | {
      kind: "native";
      trackId: string;
    }
  | {
      kind: "suno";
      songId: string;
      playlistId?: string;
    };

export interface PartyGuestRequest {
  protocol: "jukebot.party.v1";
  requestId: string;
  guestName: string;
  catalogHash: string;
  selection: PartySelection;
  sentAt: string;
}

export type PartyDecisionKind = "accepted" | "refused";

export interface PartyDecision {
  protocol: "jukebot.party.v1";
  requestId: string;
  decision: PartyDecisionKind;
  reason?: string;
  receiptId: string;
  decidedAt: string;
  effectReceiptId?: string;
}

export interface PartyRequestRecord {
  request: PartyGuestRequest;
  peerId: string;
  resolvedTitle: string;
  status: "pending" | PartyDecisionKind;
  receivedAt: string;
  decision?: PartyDecision;
}

export interface PartyReceipt {
  receiptId: string;
  requestId: string;
  peerId: string;
  guestName: string;
  selection: PartySelection;
  resolvedTitle: string;
  decision: PartyDecisionKind;
  reason?: string;
  catalogHash: string;
  decidedAt: string;
  effectReceiptId?: string;
}

export interface PartyInvite {
  protocol: "jukebot.party.v1";
  roomId: string;
  hostPeerId: string;
  password: string;
  transport?: PartyTransportProfile;
}

export interface PartyJoinInfo {
  roomId: string;
  hostPeerId: string;
  password: string;
  transport?: PartyTransportProfile;
}
