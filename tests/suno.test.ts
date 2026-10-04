import { describe, expect, it } from "vitest";
import { createBundle } from "../src/core/bundle";
import { initialRoomState } from "../src/core/reducer";
import type { SunoPlaylist } from "../src/core/types";
import {
  normalizeSunoSongUrl,
  parseSunoPlaylistUrl,
  parseSunoSongUrl,
  parseSunoTrackList,
  sunoEmbedUrl,
} from "../src/sources/suno";

const SONG_A = "b0e0bef4-e8b1-4b52-aee6-db1bd8124c55";
const SONG_B = "ab39a04d-b2e6-463b-9b8e-ddea725422f5";
const PLAYLIST = "6bbb126c-fea4-449d-95ff-84f311926b0a";

describe("Suno source parser", () => {
  it("parses canonical song and embed URLs into one stable song identity", () => {
    const song = parseSunoSongUrl(`https://suno.com/song/${SONG_A}`);
    const embed = parseSunoSongUrl(`https://www.suno.com/embed/${SONG_A}?x=1`);

    expect(song?.songId).toBe(SONG_A);
    expect(embed?.songId).toBe(SONG_A);
    expect(song?.songUrl).toBe(normalizeSunoSongUrl(SONG_A));
    expect(sunoEmbedUrl(SONG_A)).toBe(`https://suno.com/embed/${SONG_A}`);
  });

  it("accepts labeled lines, skips duplicates, and reports invalid entries", () => {
    const result = parseSunoTrackList([
      `Night Drive | https://suno.com/song/${SONG_A}`,
      `https://suno.com/embed/${SONG_A}`,
      `https://suno.com/song/${SONG_B}`,
      "https://example.com/not-suno",
    ].join("\n"));

    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0]?.title).toBe("Night Drive");
    expect(result.duplicateSongIds).toEqual([SONG_A]);
    expect(result.rejectedLines).toEqual(["https://example.com/not-suno"]);
  });

  it("normalizes a canonical playlist share URL but does not treat it as a song", () => {
    const url = `https://www.suno.com/playlist/${PLAYLIST}?share=1`;

    expect(parseSunoPlaylistUrl(url)).toBe(`https://suno.com/playlist/${PLAYLIST}`);
    expect(parseSunoSongUrl(url)).toBeNull();
  });
});

describe("Suno bundle manifest", () => {
  it("exports Suno source playlists without local audio bytes", () => {
    const suno: SunoPlaylist = {
      id: "suno-test",
      name: "Hosted set",
      playlistUrl: `https://suno.com/playlist/${PLAYLIST}`,
      tracks: [
        {
          songId: SONG_A,
          title: "Track A",
          songUrl: `https://suno.com/song/${SONG_A}`,
        },
      ],
      createdAt: "fixed",
      updatedAt: "fixed",
    };

    const bundle = createBundle(
      initialRoomState("test"),
      [],
      [],
      "fixed",
      [suno],
    );

    expect(bundle.sunoPlaylists).toEqual([suno]);
    expect(bundle.media).toEqual([]);
    expect(JSON.stringify(bundle)).not.toContain("cdn1.suno.ai");
  });
});
