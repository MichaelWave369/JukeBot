import { useEffect, useMemo, useState } from "react";
import type { SunoPlaylist } from "../core/types";
import type { JukePersistence } from "../persistence/indexedDb";
import {
  parseSunoPlaylistUrl,
  parseSunoTrackList,
  sunoEmbedUrl,
} from "../sources/suno";

export interface SunoRequestedSelection {
  playlistId?: string;
  songId: string;
  token: string;
}

interface SunoDeckProps {
  persistence: JukePersistence | null;
  playlists: SunoPlaylist[];
  requestedSelection?: SunoRequestedSelection | null;
  onPlaylistsChange: (playlists: SunoPlaylist[]) => void;
  onNotice: (message: string) => void;
}

function newId(): string {
  return `suno-${crypto.randomUUID()}`;
}

export function SunoDeck({
  persistence,
  playlists,
  requestedSelection,
  onPlaylistsChange,
  onNotice,
}: SunoDeckProps) {
  const [name, setName] = useState("");
  const [playlistUrlInput, setPlaylistUrlInput] = useState("");
  const [songLinksInput, setSongLinksInput] = useState("");
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(
    playlists[0]?.id ?? null,
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!playlists.length) {
      setActivePlaylistId(null);
      setActiveIndex(0);
      return;
    }

    if (!activePlaylistId || !playlists.some((playlist) => playlist.id === activePlaylistId)) {
      setActivePlaylistId(playlists[0]!.id);
      setActiveIndex(0);
    }
  }, [activePlaylistId, playlists]);

  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) ?? null,
    [activePlaylistId, playlists],
  );

  const activeTrack = activePlaylist?.tracks[activeIndex] ?? null;

  useEffect(() => {
    if (!requestedSelection) return;

    const preferred = requestedSelection.playlistId
      ? playlists.find((playlist) => playlist.id === requestedSelection.playlistId)
      : undefined;

    const playlist =
      preferred?.tracks.some((track) => track.songId === requestedSelection.songId)
        ? preferred
        : playlists.find((candidate) =>
            candidate.tracks.some((track) => track.songId === requestedSelection.songId),
          );

    if (!playlist) return;

    const index = playlist.tracks.findIndex(
      (track) => track.songId === requestedSelection.songId,
    );
    if (index < 0) return;

    setActivePlaylistId(playlist.id);
    setActiveIndex(index);
  }, [playlists, requestedSelection]);

  async function refresh() {
    if (!persistence) return;
    onPlaylistsChange(await persistence.listSunoPlaylists());
  }

  async function createPlaylist() {
    if (!persistence) {
      onNotice("Suno Deck persistence requires IndexedDB");
      return;
    }

    const parsedPlaylistUrl = playlistUrlInput.trim()
      ? parseSunoPlaylistUrl(playlistUrlInput)
      : null;

    if (playlistUrlInput.trim() && !parsedPlaylistUrl) {
      onNotice("That is not a canonical Suno playlist URL");
      return;
    }

    const parsed = parseSunoTrackList(songLinksInput);
    if (!parsed.tracks.length) {
      onNotice("Add at least one canonical Suno song or embed URL");
      return;
    }

    const now = new Date().toISOString();
    const playlist: SunoPlaylist = {
      id: newId(),
      name: name.trim() || `Suno Set ${new Date().toLocaleString()}`,
      playlistUrl: parsedPlaylistUrl ?? undefined,
      tracks: parsed.tracks,
      createdAt: now,
      updatedAt: now,
    };

    await persistence.saveSunoPlaylist(playlist);
    await refresh();
    setActivePlaylistId(playlist.id);
    setActiveIndex(0);
    setName("");
    setPlaylistUrlInput("");
    setSongLinksInput("");

    const detail = [
      `${playlist.tracks.length} Suno track${playlist.tracks.length === 1 ? "" : "s"} saved`,
      parsed.duplicateSongIds.length
        ? `${parsed.duplicateSongIds.length} duplicate${parsed.duplicateSongIds.length === 1 ? "" : "s"} skipped`
        : "",
      parsed.rejectedLines.length
        ? `${parsed.rejectedLines.length} invalid line${parsed.rejectedLines.length === 1 ? "" : "s"} skipped`
        : "",
    ].filter(Boolean).join(" · ");

    onNotice(detail);
  }

  async function deletePlaylist(playlistId: string) {
    if (!persistence) return;
    await persistence.deleteSunoPlaylist(playlistId);
    await refresh();
    onNotice("Suno source playlist removed from JukeBot");
  }

  function selectPlaylist(playlistId: string) {
    setActivePlaylistId(playlistId);
    setActiveIndex(0);
  }

  function previous() {
    if (!activePlaylist?.tracks.length) return;
    setActiveIndex((index) =>
      (index - 1 + activePlaylist.tracks.length) % activePlaylist.tracks.length,
    );
  }

  function next() {
    if (!activePlaylist?.tracks.length) return;
    setActiveIndex((index) => (index + 1) % activePlaylist.tracks.length);
  }

  return (
    <section className="panel suno-deck">
      <div className="panel-head suno-head">
        <div>
          <p className="eyebrow">SUNO SOURCE ADAPTER</p>
          <h3>SUNO DECK</h3>
        </div>
        <span>HOSTED PLAYER · NO SCRAPING</span>
      </div>

      <div className="suno-layout">
        <div className="suno-builder">
          <label>
            PLAYLIST NAME
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Night drive, FUNKtendo, mission archive..."
            />
          </label>

          <label>
            SUNO PLAYLIST SHARE URL
            <input
              value={playlistUrlInput}
              onChange={(event) => setPlaylistUrlInput(event.target.value)}
              placeholder="https://suno.com/playlist/..."
            />
          </label>

          <label>
            SUNO SONG LINKS
            <textarea
              value={songLinksInput}
              onChange={(event) => setSongLinksInput(event.target.value)}
              placeholder={"One per line\nTrack Title | https://suno.com/song/UUID\nhttps://suno.com/song/UUID"}
              rows={7}
            />
          </label>

          <button onClick={() => void createPlaylist()}>SAVE SUNO PLAYLIST</button>

          <p className="source-note">
            The playlist URL is kept as provenance. JukeBot plays individual songs through
            Suno&apos;s hosted embed player rather than scraping Suno audio or private APIs.
          </p>
        </div>

        <div className="suno-player">
          {activeTrack && activePlaylist ? (
            <>
              <div className="suno-now">
                <div>
                  <p className="eyebrow">SUNO NOW</p>
                  <h4>{activeTrack.title}</h4>
                  <small>
                    {activeIndex + 1} / {activePlaylist.tracks.length} · {activePlaylist.name}
                  </small>
                </div>
                <div className="row-actions">
                  <button onClick={previous}>PREV</button>
                  <button onClick={next}>NEXT</button>
                </div>
              </div>

              <iframe
                className="suno-frame"
                key={activeTrack.songId}
                src={sunoEmbedUrl(activeTrack.songId)}
                title={`Suno player — ${activeTrack.title}`}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
              />

              <div className="suno-links">
                <a
                  className="live-badge"
                  href={activeTrack.songUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  OPEN SONG IN SUNO
                </a>
                {activePlaylist.playlistUrl ? (
                  <a
                    className="live-badge"
                    href={activePlaylist.playlistUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    OPEN PLAYLIST IN SUNO
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <div className="suno-empty">
              <strong>No Suno playlist loaded.</strong>
              <span>Add canonical Suno song links and the hosted player will live here.</span>
            </div>
          )}
        </div>
      </div>

      <div className="suno-library">
        <div className="panel-head mini">
          <h3>SAVED SUNO PLAYLISTS</h3>
          <span>{playlists.length}</span>
        </div>

        {playlists.length ? (
          <div className="suno-playlist-grid">
            {playlists.map((playlist) => (
              <article
                className={`suno-playlist-card ${playlist.id === activePlaylistId ? "active" : ""}`}
                key={playlist.id}
              >
                <button className="suno-card-main" onClick={() => selectPlaylist(playlist.id)}>
                  <strong>{playlist.name}</strong>
                  <small>
                    {playlist.tracks.length} TRACK{playlist.tracks.length === 1 ? "" : "S"}
                  </small>
                </button>
                <button
                  className="danger"
                  onClick={() => void deletePlaylist(playlist.id)}
                  aria-label={`Delete ${playlist.name}`}
                >
                  DELETE
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">No Suno source playlists saved yet.</p>
        )}

        {activePlaylist?.tracks.length ? (
          <div className="suno-track-list">
            {activePlaylist.tracks.map((track, index) => (
              <button
                key={track.songId}
                className={`suno-track-button ${index === activeIndex ? "active" : ""}`}
                onClick={() => setActiveIndex(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{track.title}</strong>
                <code>{track.songId.slice(0, 8)}</code>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
