import { joinRoom, selfId } from "trystero";
import type {
  PartyDecision,
  PartyGuestHello,
  PartyGuestRequest,
  PartyHostSnapshot,
} from "./types";

const APP_ID = "io.github.michaelwave369.jukebot.party.v1";

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
): PartyNetwork {
  const room = joinRoom(
    {
      appId: APP_ID,
      password,
    },
    roomId,
    {
      onJoinError: ({ error }) => {
        handlers.onJoinError?.(
          error instanceof Error ? error.message : String(error),
        );
      },
    },
  );

  const snapshotAction = room.makeAction<PartyHostSnapshot>("jb-snapshot");
  const helloAction = room.makeAction<PartyGuestHello>("jb-guest-hello");
  const requestAction = room.makeAction<PartyGuestRequest>("jb-request");
  const decisionAction = room.makeAction<PartyDecision>("jb-decision");

  room.onPeerJoin = (peerId) => handlers.onPeerJoin?.(peerId);
  room.onPeerLeave = (peerId) => handlers.onPeerLeave?.(peerId);

  snapshotAction.onMessage = (data, { peerId }) =>
    handlers.onSnapshot?.(data, peerId);

  helloAction.onMessage = (data, { peerId }) =>
    handlers.onGuestHello?.(data, peerId);

  requestAction.onMessage = (data, { peerId }) =>
    handlers.onGuestRequest?.(data, peerId);

  decisionAction.onMessage = (data, { peerId }) =>
    handlers.onDecision?.(data, peerId);

  return {
    selfPeerId: selfId,
    peerIds: () => Object.keys(room.getPeers()),
    sendSnapshot: async (snapshot, target) => {
      await snapshotAction.send(snapshot, target ? { target } : undefined);
    },
    sendGuestHello: async (hello, target) => {
      await helloAction.send(hello, { target });
    },
    sendGuestRequest: async (request, target) => {
      await requestAction.send(request, { target });
    },
    sendDecision: async (decision, target) => {
      await decisionAction.send(decision, { target });
    },
    leave: () => room.leave(),
  };
}
