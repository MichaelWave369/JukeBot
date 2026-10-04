import { joinRoom, selfId } from "trystero";
import type {
  PartyDecision,
  PartyGuestHello,
  PartyGuestRequest,
  PartyHostSnapshot,
  PartyTransportProfile,
} from "./types";
import { normalizeTransportProfile } from "./transport";

const APP_ID = "io.github.michaelwave369.jukebot.party.v1";

type WireObject = { [key: string]: any };

export interface PartyNetworkHandlers {
  onPeerJoin?: (peerId: string) => void;
  onPeerLeave?: (peerId: string) => void;
  onSnapshot?: (snapshot: PartyHostSnapshot, peerId: string) => void;
  onGuestHello?: (hello: PartyGuestHello, peerId: string) => void;
  onGuestRequest?: (request: PartyGuestRequest, peerId: string) => void;
  onDecision?: (decision: PartyDecision, peerId: string) => void;
  onJoinError?: (message: string) => void;
}

export interface PartyNetwork {
  selfPeerId: string;
  peerIds: () => string[];
  sendSnapshot: (snapshot: PartyHostSnapshot, target?: string) => Promise<void>;
  sendGuestHello: (hello: PartyGuestHello, target: string) => Promise<void>;
  sendGuestRequest: (request: PartyGuestRequest, target: string) => Promise<void>;
  sendDecision: (decision: PartyDecision, target: string) => Promise<void>;
  leave: () => void;
}

export function createPartyNetwork(
  roomId: string,
  password: string,
  handlers: PartyNetworkHandlers = {},
  transport?: PartyTransportProfile,
): PartyNetwork {
  const profile = normalizeTransportProfile(transport);

  const relayConfig = profile.relayUrls?.length
    ? {
        urls: profile.relayUrls,
        warnOnRelayFailure: true,
      }
    : {
        redundancy: profile.relayRedundancy ?? 5,
        warnOnRelayFailure: true,
      };

  const turnConfig = profile.turn?.map((server) => ({
    urls: server.urls,
    username: server.username,
    credential: server.credential,
  }));

  const room = joinRoom(
    {
      appId: APP_ID,
      password,
      relayConfig,
      turnConfig,
    } as any,
    roomId,
    {
      onJoinError: ({ error }) => {
        handlers.onJoinError?.(String(error));
      },
    },
  );

  // Trystero's wire generic requires a dictionary-shaped JSON payload.
  // Keep that permissiveness at this serialization seam only; JukeBot's
  // protocol remains strongly typed on both sides of the adapter.
  const snapshotAction = room.makeAction<WireObject>("jb-snapshot");
  const helloAction = room.makeAction<WireObject>("jb-guest-hello");
  const requestAction = room.makeAction<WireObject>("jb-request");
  const decisionAction = room.makeAction<WireObject>("jb-decision");

  room.onPeerJoin = (peerId) => handlers.onPeerJoin?.(peerId);
  room.onPeerLeave = (peerId) => handlers.onPeerLeave?.(peerId);

  snapshotAction.onMessage = (data, { peerId }) =>
    handlers.onSnapshot?.(data as PartyHostSnapshot, peerId);

  helloAction.onMessage = (data, { peerId }) =>
    handlers.onGuestHello?.(data as PartyGuestHello, peerId);

  requestAction.onMessage = (data, { peerId }) =>
    handlers.onGuestRequest?.(data as PartyGuestRequest, peerId);

  decisionAction.onMessage = (data, { peerId }) =>
    handlers.onDecision?.(data as PartyDecision, peerId);

  return {
    selfPeerId: selfId,
    peerIds: () => Object.keys(room.getPeers()),
    sendSnapshot: async (snapshot, target) => {
      await snapshotAction.send(
        snapshot as unknown as WireObject,
        target ? { target } : undefined,
      );
    },
    sendGuestHello: async (hello, target) => {
      await helloAction.send(hello as unknown as WireObject, { target });
    },
    sendGuestRequest: async (request, target) => {
      await requestAction.send(request as unknown as WireObject, { target });
    },
    sendDecision: async (decision, target) => {
      await decisionAction.send(decision as unknown as WireObject, { target });
    },
    leave: () => room.leave(),
  };
}
