import type { RoomState, Track } from "./types";

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`);

  return `{${entries.join(",")}}`;
}

export function stableHash(value: unknown): string {
  const input = canonicalize(value);
  let hash = 0x811c9dc5;

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function portableTrack(track: Track): Track {
  return {
    ...track,
    tags: track.tags ? [...track.tags].sort() : undefined,
    source: track.sourceType === "local" ? `local://${track.id}` : track.source,
  };
}

export function portableRoomState(state: RoomState): RoomState {
  return {
    ...state,
    queue: [...state.queue],
    tracks: Object.fromEntries(
      Object.entries(state.tracks)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, track]) => [id, portableTrack(track)]),
    ),
  };
}

export function roomStateHash(state: RoomState): string {
  return stableHash(portableRoomState(state));
}
