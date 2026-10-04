import { canPerform } from "./authority";
import { stableHash } from "./hash";
import { initialRoomState, reduceRoom } from "./reducer";
import type {
  ActionEnvelope,
  Receipt,
  RoomState,
  SubmissionResult,
  Track,
} from "./types";

type Listener = (state: RoomState, receipt: Receipt) => void;
type Clock = () => string;

function cloneTrack(track: Track): Track {
  return {
    ...track,
    tags: track.tags ? [...track.tags] : undefined,
  };
}

function cloneState(state: RoomState): RoomState {
  return {
    ...state,
    queue: [...state.queue],
    tracks: Object.fromEntries(
      Object.entries(state.tracks).map(([id, track]) => [id, cloneTrack(track)]),
    ),
  };
}

export class JukeRuntime {
  private state: RoomState;
  private readonly receipts: Receipt[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(
    roomId = "local-room",
    private readonly clock: Clock = () => new Date().toISOString(),
    restoredState?: RoomState,
    restoredReceipts: Receipt[] = [],
  ) {
    this.state = restoredState ? cloneState(restoredState) : initialRoomState(roomId);
    this.receipts.push(...restoredReceipts);
  }

  observe(): RoomState {
    return cloneState(this.state);
  }

  ledger(): Receipt[] {
    return [...this.receipts];
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  submit(envelope: ActionEnvelope): SubmissionResult {
    const allowed = canPerform(envelope.actor.role, envelope.action);

    if (allowed) {
      this.state = reduceRoom(this.state, envelope.action);
    }

    const receipt: Receipt = {
      receiptId: stableHash({
        actionId: envelope.actionId,
        seq: this.state.seq,
        accepted: allowed,
        state: this.state,
      }),
      seq: this.state.seq,
      at: this.clock(),
      actionId: envelope.actionId,
      actor: envelope.actor,
      action: envelope.action,
      accepted: allowed,
      reason: allowed ? undefined : `${envelope.actor.role} is not authorized for ${envelope.action.type}`,
      stateHash: stableHash(this.state),
    };

    this.receipts.push(receipt);
    for (const listener of this.listeners) listener(this.observe(), receipt);

    return { state: this.observe(), receipt };
  }
}
