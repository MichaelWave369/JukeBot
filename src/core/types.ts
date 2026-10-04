export type ActorRole =
  | "operator"
  | "dj"
  | "guest"
  | "agent"
  | "replay"
  | "script";

export interface Actor {
  id: string;
  role: ActorRole;
  label?: string;
}

export interface Track {
  id: string;
  title: string;
  artist?: string;
  source: string;
  sourceType: "local" | "url";
}

export type TransportState = "stopped" | "playing" | "paused";
export type RepeatMode = "off" | "one" | "all";

export interface RoomState {
  roomId: string;
  seq: number;
  transport: TransportState;
  currentTrackId: string | null;
  queue: string[];
  tracks: Record<string, Track>;
  volume: number;
  repeat: RepeatMode;
}

export type JukeAction =
  | { type: "ADD_TRACK"; track: Track }
  | { type: "ENQUEUE_TRACK"; trackId: string }
  | { type: "REMOVE_FROM_QUEUE"; index: number }
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "STOP" }
  | { type: "SKIP" }
  | { type: "SET_VOLUME"; volume: number }
  | { type: "SET_REPEAT"; repeat: RepeatMode }
  | { type: "CLEAR_QUEUE" };

export interface ActionEnvelope {
  actionId: string;
  actor: Actor;
  action: JukeAction;
}

export interface Receipt {
  receiptId: string;
  seq: number;
  at: string;
  actionId: string;
  actor: Actor;
  action: JukeAction;
  accepted: boolean;
  reason?: string;
  stateHash: string;
}

export interface SubmissionResult {
  state: RoomState;
  receipt: Receipt;
}
