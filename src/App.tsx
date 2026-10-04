import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { BrowserAudioAdapter } from "./audio/browserAudio";
import { SunoDeck } from "./components/SunoDeck";
import { assessBundle, createBundle, parseBundle } from "./core/bundle";
import { validateReplay } from "./core/replay";
import { JukeRuntime } from "./core/runtime";
import type {
  Actor,
  JukeAction,
  Playlist,
  Receipt,
  RoomState,
  SunoPlaylist,
  Track,
  TrackMetadataPatch,
} from "./core/types";
import type { JukePersistence } from "./persistence/indexedDb";

interface AppProps {
  runtime: JukeRuntime;
  persistence: JukePersistence | null;
}

const operator: Actor = { id: "operator.local", role: "operator", label: "Operator" };
const agent: Actor = { id: "jukebot.local", role: "agent", label: "JukeBot" };

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function label(track: Track | undefined): string {
  return track?.title ?? "Unknown track";
}

function cleanTags(value: string): string[] {
  return [...new Set(
    value
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  )];
}

export function App({ runtime, persistence }: AppProps) {
  const [state, setState] = useState<RoomState>(() => runtime.observe());
  const [receipts, setReceipts] = useState<Receipt[]>(() => runtime.ledger());
  const [urlInput, setUrlInput] = useState("");
  const [search, setSearch] = useState("");
  const [playlistName, setPlaylistName] = useState("");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [sunoPlaylists, setSunoPlaylists] = useState<SunoPlaylist[]>([]);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editCoverUrl, setEditCoverUrl] = useState("");
  const [notice, setNotice] = useState(() => {
    const carried = sessionStorage.getItem("jukebot.notice");
    return carried ??
      (persistence
        ? "IndexedDB crate restored"
        : "Persistent storage unavailable; running ephemeral");
  });
  const audio = useMemo(() => new BrowserAudioAdapter(), []);

  function submit(action: JukeAction, actor: Actor = operator) {
    return runtime.submit({ actionId: id("act"), actor, action });
  }

  async function refreshPlaylists() {
    if (!persistence) {
      setPlaylists([]);
      setSunoPlaylists([]);
      return;
    }
    try {
      const [nativePlaylists, sunoSources] = await Promise.all([
        persistence.listPlaylists(),
        persistence.listSunoPlaylists(),
      ]);
      setPlaylists(nativePlaylists);
      setSunoPlaylists(sunoSources);
    } catch {
      setNotice("Could not read saved playlists");
    }
  }

  useEffect(() => {
    sessionStorage.removeItem("jukebot.notice");
    void refreshPlaylists();

    audio.setEndedHandler(() => submit({ type: "SKIP" }, agent));
    void audio.sync(runtime.observe());

    return runtime.subscribe((next) => {
      setState(next);
      setReceipts(runtime.ledger());
      void audio.sync(next);
      if (persistence) {
        void persistence
          .saveSession(next, runtime.ledger())
          .catch(() => setNotice("Session save failed; playback is still available"));
      }
    });
  }, [audio, persistence, runtime]);

  const current = state.currentTrackId ? state.tracks[state.currentTrackId] : undefined;
  const tracks = Object.values(state.tracks);
  const filteredTracks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tracks;

    return tracks.filter((track) => {
      const haystack = [
        track.title,
        track.artist ?? "",
        ...(track.tags ?? []),
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    });
  }, [search, tracks]);

  const replay = useMemo(
    () => validateReplay(receipts, state.roomId),
    [receipts, state.roomId],
  );

  async function addLocalFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    for (const file of files) {
      const track: Track = {
        id: id("track"),
        title: file.name.replace(/\.[^.]+$/, ""),
        source: URL.createObjectURL(file),
        sourceType: "local",
        tags: [],
        addedAt: new Date().toISOString(),
      };

      if (persistence) {
        try {
          await persistence.putLocalTrack(track, file);
        } catch {
          setNotice(`Could not persist ${track.title}; it is loaded for this session only`);
        }
      }

      submit({ type: "ADD_TRACK", track });
    }

    event.target.value = "";
  }

  async function addRemoteUrl() {
    const source = urlInput.trim();
    if (!source) return;

    const fallback = source.split("/").pop()?.split("?")[0] || "Remote track";
    const track: Track = {
      id: id("track"),
      title: decodeURIComponent(fallback),
      source,
      sourceType: "url",
      tags: [],
      addedAt: new Date().toISOString(),
    };

    if (persistence) {
      try {
        await persistence.putUrlTrack(track);
      } catch {
        setNotice("Remote track loaded, but persistent storage failed");
      }
    }

    submit({ type: "ADD_TRACK", track });
    setUrlInput("");
  }

  async function removeTrack(trackId: string) {
    if (persistence) {
      try {
        await persistence.removeTrack(trackId);
        await refreshPlaylists();
      } catch {
        setNotice("Could not remove the durable media record");
        return;
      }
    }
    submit({ type: "REMOVE_TRACK", trackId });
  }

  function startEdit(track: Track) {
    setEditingTrackId(track.id);
    setEditTitle(track.title);
    setEditArtist(track.artist ?? "");
    setEditTags((track.tags ?? []).join(", "));
    setEditCoverUrl(track.coverUrl ?? "");
  }

  async function saveEdit() {
    if (!editingTrackId) return;

    const patch: TrackMetadataPatch = {
      title: editTitle.trim() || "Untitled",
      artist: editArtist.trim() || undefined,
      tags: cleanTags(editTags),
      coverUrl: editCoverUrl.trim() || undefined,
    };

    if (persistence) {
      try {
        await persistence.updateTrackMetadata(editingTrackId, patch);
      } catch {
        setNotice("Metadata changed in memory only because durable update failed");
      }
    }

    submit({ type: "UPDATE_TRACK_METADATA", trackId: editingTrackId, patch });
    setEditingTrackId(null);
  }

  function botPick() {
    if (!tracks.length) return;
    const choice = tracks[Math.floor(Math.random() * tracks.length)];
    if (choice) submit({ type: "ENQUEUE_TRACK", trackId: choice.id }, agent);
  }

  async function saveQueueAsPlaylist() {
    if (!persistence) {
      setNotice("Playlists require persistent browser storage");
      return;
    }
    if (!state.queue.length) {
      setNotice("Queue something first; an empty playlist is just administrative optimism");
      return;
    }

    const now = new Date().toISOString();
    const playlist: Playlist = {
      id: id("playlist"),
      name: playlistName.trim() || `Set ${new Date().toLocaleString()}`,
      trackIds: [...state.queue],
      createdAt: now,
      updatedAt: now,
    };

    await persistence.savePlaylist(playlist);
    setPlaylistName("");
    await refreshPlaylists();
    setNotice(`Saved playlist: ${playlist.name}`);
  }

  function loadPlaylist(playlist: Playlist) {
    submit({ type: "CLEAR_QUEUE" });
    let missing = 0;
    for (const trackId of playlist.trackIds) {
      if (!state.tracks[trackId]) {
        missing += 1;
        continue;
      }
      submit({ type: "ENQUEUE_TRACK", trackId });
    }
    setNotice(
      missing
        ? `Loaded ${playlist.name}; ${missing} missing track reference(s) skipped`
        : `Loaded playlist: ${playlist.name}`,
    );
  }

  async function deletePlaylist(playlistId: string) {
    if (!persistence) return;
    await persistence.deletePlaylist(playlistId);
    await refreshPlaylists();
  }

  function exportSession() {
    const bundle = createBundle(state, receipts, playlists, sunoPlaylists);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `jukebot-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported session bundle · replay ${replay.status}`);
  }

  async function importSession(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !persistence) {
      if (!persistence) setNotice("Import requires persistent browser storage");
      return;
    }

    try {
      const bundle = parseBundle(await file.text());
      const available = await persistence.trackIds();
      const assessment = assessBundle(bundle, available);

      if (assessment.replayStatus === "MISMATCH") {
        setNotice("Import refused: receipt replay mismatch");
        return;
      }

      const result = await persistence.importBundle(bundle);
      const message = result.missingLocalTrackIds.length
        ? `Imported bundle; ${result.missingLocalTrackIds.length} local file(s) must be re-added on this device`
        : `Imported bundle · replay ${assessment.replayStatus}`;

      sessionStorage.setItem("jukebot.notice", message);
      window.location.reload();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not import session bundle");
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">LOCAL-FIRST / AGENT-NATIVE / REPLAYABLE</p>
          <h1>JukeBot</h1>
          <p className="tagline">
            A governed jukebox where humans, bots, scripts and peers share one action boundary.
          </p>
        </div>
        <div className="hero-badges">
          <a
            className="live-badge"
            href="https://github.com/MichaelWave369/JukeBot"
            target="_blank"
            rel="noreferrer"
          >
            OPEN SOURCE
          </a>
          <div className="status">{state.transport.toUpperCase()}</div>
        </div>
      </header>

      <section className="now panel">
        <div className={`record ${state.transport === "playing" ? "spinning" : ""}`}>
          {current?.coverUrl ? (
            <img className="cover-art" src={current.coverUrl} alt="" />
          ) : (
            <div className="record-core">Φ</div>
          )}
        </div>
        <div>
          <p className="eyebrow">NOW PLAYING</p>
          <h2>{current?.title ?? "Nothing loaded"}</h2>
          <p className="muted">{current?.artist ?? (current ? "Unknown artist" : "Feed the machine a track.")}</p>
          {current?.tags?.length ? (
            <div className="tag-row">
              {current.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
            </div>
          ) : null}

          <div className="transport">
            <button onClick={() => submit({ type: "PLAY" })}>PLAY</button>
            <button onClick={() => submit({ type: "PAUSE" })}>PAUSE</button>
            <button onClick={() => submit({ type: "SKIP" })}>SKIP</button>
            <button onClick={() => submit({ type: "STOP" })}>STOP</button>
          </div>

          <label className="volume">
            VOLUME
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={state.volume}
              onChange={(event) =>
                submit({ type: "SET_VOLUME", volume: Number(event.target.value) })
              }
            />
            <span>{Math.round(state.volume * 100)}%</span>
          </label>
        </div>
      </section>

      <div className="memory-strip">
        <strong>{persistence ? "MEMORY ON" : "MEMORY OFF"}</strong>
        <span>{notice}</span>
        <span>Crate, playlists and room state survive reloads.</span>
      </div>

      <section className="toolbar panel">
        <div>
          <p className="eyebrow">LIBRARY INTELLIGENCE</p>
          <input
            className="search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title, artist or tag"
          />
        </div>
        <div className="session-actions">
          <span className={`replay-badge replay-${replay.status.toLowerCase()}`}>
            REPLAY {replay.status.replace("_", " ")}
          </span>
          <button onClick={exportSession}>EXPORT SESSION</button>
          <label className="file-pick compact">
            IMPORT SESSION
            <input type="file" accept="application/json,.json" hidden onChange={importSession} />
          </label>
        </div>
      </section>

      <SunoDeck
        persistence={persistence}
        playlists={sunoPlaylists}
        onPlaylistsChange={setSunoPlaylists}
        onNotice={setNotice}
      />

      <section className="grid">
        <div className="panel">
          <div className="panel-head">
            <h3>CRATE</h3>
            <span>{filteredTracks.length}/{tracks.length} TRACKS</span>
          </div>

          <label className="file-pick">
            ADD LOCAL AUDIO
            <input type="file" accept="audio/*" multiple hidden onChange={addLocalFiles} />
          </label>

          <div className="url-add">
            <input
              value={urlInput}
              onChange={(event) => setUrlInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addRemoteUrl();
              }}
              placeholder="Direct audio URL"
            />
            <button onClick={() => void addRemoteUrl()}>ADD URL</button>
          </div>

          <div className="list">
            {filteredTracks.length ? (
              filteredTracks.map((track) => (
                <div className="row" key={track.id}>
                  <div className="track-copy">
                    <strong>{track.title}</strong>
                    <small>{track.artist ?? track.sourceType.toUpperCase()}</small>
                    {track.tags?.length ? (
                      <div className="tag-row">
                        {track.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                      </div>
                    ) : null}
                  </div>
                  <div className="row-actions">
                    <button onClick={() => submit({ type: "ENQUEUE_TRACK", trackId: track.id })}>
                      QUEUE
                    </button>
                    <button onClick={() => startEdit(track)}>EDIT</button>
                    <button className="danger" onClick={() => void removeTrack(track.id)}>
                      REMOVE
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty">No matching tracks. Even the jukebox came up empty.</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>UP NEXT</h3>
            <div className="row-actions">
              <button onClick={botPick}>BOT PICK</button>
              <button onClick={() => submit({ type: "CLEAR_QUEUE" })}>CLEAR</button>
            </div>
          </div>

          <div className="list queue-list">
            {state.queue.length ? (
              state.queue.map((trackId, index) => (
                <div className="row" key={`${trackId}-${index}`}>
                  <div>
                    <strong>{index + 1}. {label(state.tracks[trackId])}</strong>
                  </div>
                  <button onClick={() => submit({ type: "REMOVE_FROM_QUEUE", index })}>×</button>
                </div>
              ))
            ) : (
              <p className="empty">Queue is empty.</p>
            )}
          </div>

          <div className="playlist-save">
            <input
              value={playlistName}
              onChange={(event) => setPlaylistName(event.target.value)}
              placeholder="Playlist name"
            />
            <button onClick={() => void saveQueueAsPlaylist()}>SAVE QUEUE</button>
          </div>

          <div className="playlist-stack">
            <div className="panel-head mini">
              <h3>PLAYLISTS</h3>
              <span>{playlists.length}</span>
            </div>
            {playlists.length ? playlists.map((playlist) => (
              <div className="row playlist-row" key={playlist.id}>
                <div>
                  <strong>{playlist.name}</strong>
                  <small>{playlist.trackIds.length} TRACK{playlist.trackIds.length === 1 ? "" : "S"}</small>
                </div>
                <div className="row-actions">
                  <button onClick={() => loadPlaylist(playlist)}>LOAD</button>
                  <button className="danger" onClick={() => void deletePlaylist(playlist.id)}>DELETE</button>
                </div>
              </div>
            )) : <p className="empty">No saved playlists yet.</p>}
          </div>
        </div>

        <div className="panel ledger-panel">
          <div className="panel-head">
            <h3>REALITY LEDGER</h3>
            <div className="ledger-meta">
              <span>{receipts.length} RECEIPTS</span>
              <span>{replay.checkedV2} V2 VERIFIED</span>
              <span>{replay.legacyReceipts} LEGACY</span>
            </div>
          </div>
          {replay.reason ? <p className="replay-note">{replay.reason}</p> : null}
          <div className="ledger">
            {receipts.length ? (
              receipts.slice(-16).reverse().map((receipt) => (
                <div className={`receipt ${receipt.accepted ? "ok" : "no"}`} key={receipt.receiptId}>
                  <span>#{receipt.seq}</span>
                  <strong>{receipt.actor.role.toUpperCase()} · {receipt.action.type}</strong>
                  <code>{receipt.stateHashVersion ?? "legacy"} · {receipt.receiptId}</code>
                </div>
              ))
            ) : (
              <p className="empty">No actions yet.</p>
            )}
          </div>
        </div>
      </section>

      {editingTrackId ? (
        <div className="modal-backdrop" role="presentation">
          <section className="edit-modal panel" role="dialog" aria-modal="true" aria-label="Edit track metadata">
            <div className="panel-head">
              <h3>TRACK METADATA</h3>
              <button onClick={() => setEditingTrackId(null)}>×</button>
            </div>
            <label>
              TITLE
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            </label>
            <label>
              ARTIST
              <input value={editArtist} onChange={(event) => setEditArtist(event.target.value)} />
            </label>
            <label>
              TAGS
              <input
                value={editTags}
                onChange={(event) => setEditTags(event.target.value)}
                placeholder="funk, live, weird"
              />
            </label>
            <label>
              COVER IMAGE URL
              <input
                value={editCoverUrl}
                onChange={(event) => setEditCoverUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setEditingTrackId(null)}>CANCEL</button>
              <button onClick={() => void saveEdit()}>SAVE METADATA</button>
            </div>
          </section>
        </div>
      ) : null}

      <footer>
        <span>React deck · IndexedDB library · governed Action Bus · portable receipts</span>
        <span>Local audio bytes remain in this browser unless you move them yourself.</span>
      </footer>
    </main>
  );
}
