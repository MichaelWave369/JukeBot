import { portableRoomState, roomStateHash } from "./hash";
import type {
  Playlist,
  Receipt,
  RoomState,
  SunoPlaylist,
  Track,
} from "./types";
import { validateReplay } from "./replay";

export const JUKE_BUNDLE_SCHEMA = "jukebot.session.v1" as const;

export interface MediaManifestEntry {
  id: string;
  title: string;
  artist?: string;
  tags?: string[];
  coverUrl?: string;
  sourceType: Track["sourceType"];
  url?: string;
}

export interface JukeBundle {
  schema: typeof JUKE_BUNDLE_SCHEMA;
  exportedAt: string;
  room: RoomState;
  roomHash: string;
  receipts: Receipt[];
  playlists: Playlist[];
  sunoPlaylists?: SunoPlaylist[];
  media: MediaManifestEntry[];
}

export interface BundleAssessment {
  missingLocalTrackIds: string[];
  replayStatus: ReturnType<typeof validateReplay>["status"];
  roomHashMatchesReplay: boolean;
}

export function createBundle(
  state: RoomState,
  receipts: Receipt[],
  playlists: Playlist[],
  exportedAt = new Date().toISOString(),
  sunoPlaylists: SunoPlaylist[] = [],
): JukeBundle {
  const room = portableRoomState(state);
  return {
    schema: JUKE_BUNDLE_SCHEMA,
    exportedAt,
    room,
    roomHash: roomStateHash(room),
    receipts: [...receipts],
    playlists: playlists.map((playlist) => ({
      ...playlist,
      trackIds: [...playlist.trackIds],
    })),
    sunoPlaylists: sunoPlaylists.map((playlist) => ({
      ...playlist,
      tracks: playlist.tracks.map((track) => ({ ...track })),
    })),
    media: Object.values(state.tracks).map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      tags: track.tags ? [...track.tags] : undefined,
      coverUrl: track.coverUrl,
      sourceType: track.sourceType,
      url: track.sourceType === "url" ? track.source : undefined,
    })),
  };
}

export function parseBundle(input: string): JukeBundle {
  const parsed = JSON.parse(input) as Partial<JukeBundle>;

  if (parsed.schema !== JUKE_BUNDLE_SCHEMA) {
    throw new Error("Unsupported JukeBot bundle schema");
  }
  if (!parsed.room || !Array.isArray(parsed.receipts) || !Array.isArray(parsed.media)) {
    throw new Error("Malformed JukeBot session bundle");
  }

  if (parsed.sunoPlaylists && !Array.isArray(parsed.sunoPlaylists)) {
    throw new Error("Malformed Suno playlist manifest");
  }

  return parsed as JukeBundle;
}

export function assessBundle(
  bundle: JukeBundle,
  availableTrackIds: Iterable<string>,
): BundleAssessment {
  const available = new Set(availableTrackIds);
  const missingLocalTrackIds = bundle.media
    .filter((entry) => entry.sourceType === "local" && !available.has(entry.id))
    .map((entry) => entry.id);

  const replay = validateReplay(bundle.receipts, bundle.room.roomId);

  return {
    missingLocalTrackIds,
    replayStatus: replay.status,
    roomHashMatchesReplay: replay.finalHash === bundle.roomHash,
  };
}
