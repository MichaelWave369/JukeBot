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
  tags?: string[];
  coverUrl?: string;
  addedAt?: string;
}

export interface TrackMetadataPatch {
  title?: string;
  artist?: string;
  tags?: string[];
  coverUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
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
  | { type: "REMOVE_TRACK"; trackId: string }
  | { type: "UPDATE_TRACK_METADATA"; trackId: string; patch: TrackMetadataPatch }
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

export type StateHashVersion = "room-v2";

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
  stateHashVersion?: StateHashVersion;
}

export interface SubmissionResult {
  state: RoomState;
  receipt: Receipt;
}
