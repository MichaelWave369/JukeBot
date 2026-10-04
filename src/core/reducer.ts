import type { JukeAction, RoomState } from "./types";

export function initialRoomState(roomId = "local-room"): RoomState {
  return {
    roomId,
    seq: 0,
    transport: "stopped",
    currentTrackId: null,
    queue: [],
    tracks: {},
    volume: 0.82,
    repeat: "off",
  };
}

export function reduceRoom(state: RoomState, action: JukeAction): RoomState {
  const next: RoomState = {
    ...state,
    seq: state.seq + 1,
    queue: [...state.queue],
    tracks: { ...state.tracks },
  };

  switch (action.type) {
    case "ADD_TRACK":
      next.tracks[action.track.id] = action.track;
      return next;

    case "REMOVE_TRACK":
      delete next.tracks[action.trackId];
      next.queue = next.queue.filter((trackId) => trackId !== action.trackId);
      if (next.currentTrackId === action.trackId) {
        next.currentTrackId = null;
        next.transport = "stopped";
      }
      return next;

    case "ENQUEUE_TRACK":
      if (!next.tracks[action.trackId]) return next;
      next.queue.push(action.trackId);
      return next;

    case "REMOVE_FROM_QUEUE":
      if (action.index >= 0 && action.index < next.queue.length) {
        next.queue.splice(action.index, 1);
      }
      return next;

    case "PLAY":
      if (!next.currentTrackId) {
        const first = next.queue.shift();
        if (first) next.currentTrackId = first;
      }
      if (next.currentTrackId) next.transport = "playing";
      return next;

    case "PAUSE":
      if (next.currentTrackId) next.transport = "paused";
      return next;

    case "STOP":
      next.transport = "stopped";
      return next;

    case "SKIP": {
      const following = next.queue.shift() ?? null;
      next.currentTrackId = following;
      next.transport = following ? "playing" : "stopped";
      return next;
    }

    case "SET_VOLUME":
      next.volume = Math.max(0, Math.min(1, action.volume));
      return next;

    case "SET_REPEAT":
      next.repeat = action.repeat;
      return next;

    case "CLEAR_QUEUE":
      next.queue = [];
      return next;
  }
}
