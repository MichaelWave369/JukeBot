import type { SunoTrackRef } from "../core/types";

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";
const SONG_PATTERN = new RegExp(`^https://(?:www\\.)?suno\\.com/(?:song|embed)/(${UUID})(?:[/?#].*)?$`);
const PLAYLIST_PATTERN = new RegExp(`^https://(?:www\\.)?suno\\.com/playlist/(${UUID})(?:[/?#].*)?$`);

export interface ParsedSunoLine {
  track: SunoTrackRef;
  sourceLine: string;
}

export interface SunoParseResult {
  tracks: SunoTrackRef[];
  rejectedLines: string[];
  duplicateSongIds: string[];
}

export function normalizeSunoSongUrl(songId: string): string {
  return `https://suno.com/song/${songId.toLowerCase()}`;
}

export function sunoEmbedUrl(songId: string): string {
  return `https://suno.com/embed/${songId.toLowerCase()}`;
}

export function parseSunoSongUrl(input: string): SunoTrackRef | null {
  const trimmed = input.trim();
  const match = trimmed.match(SONG_PATTERN);
  if (!match?.[1]) return null;

  const songId = match[1].toLowerCase();
  return {
    songId,
    title: `Suno ${songId.slice(0, 8)}`,
    songUrl: normalizeSunoSongUrl(songId),
  };
}

export function parseSunoPlaylistUrl(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(PLAYLIST_PATTERN);
  if (!match?.[1]) return null;
  return `https://suno.com/playlist/${match[1].toLowerCase()}`;
}

function parseLabeledLine(line: string): ParsedSunoLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const direct = parseSunoSongUrl(trimmed);
  if (direct) return { track: direct, sourceLine: line };

  const delimiterIndex = trimmed.indexOf("|");
  if (delimiterIndex < 0) return null;

  const title = trimmed.slice(0, delimiterIndex).trim();
  const url = trimmed.slice(delimiterIndex + 1).trim();
  const parsed = parseSunoSongUrl(url);
  if (!parsed) return null;

  return {
    sourceLine: line,
    track: {
      ...parsed,
      title: title || parsed.title,
    },
  };
}

export function parseSunoTrackList(input: string): SunoParseResult {
  const tracks: SunoTrackRef[] = [];
  const rejectedLines: string[] = [];
  const duplicateSongIds: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parsed = parseLabeledLine(line);
    if (!parsed) {
      rejectedLines.push(line);
      continue;
    }

    if (seen.has(parsed.track.songId)) {
      duplicateSongIds.push(parsed.track.songId);
      continue;
    }

    seen.add(parsed.track.songId);
    tracks.push(parsed.track);
  }

  return { tracks, rejectedLines, duplicateSongIds };
}
