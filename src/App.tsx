import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { BrowserAudioAdapter } from "./audio/browserAudio";
import { JukeRuntime } from "./core/runtime";
import type { Actor, JukeAction, Receipt, RoomState, Track } from "./core/types";
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

export function App({ runtime, persistence }: AppProps) {
  const [state, setState] = useState<RoomState>(() => runtime.observe());
  const [receipts, setReceipts] = useState<Receipt[]>(() => runtime.ledger());
  const [urlInput, setUrlInput] = useState("");
  const [notice, setNotice] = useState(
    persistence ? "IndexedDB crate restored" : "Persistent storage unavailable; running ephemeral",
  );
  const audio = useMemo(() => new BrowserAudioAdapter(), []);

  function submit(action: JukeAction, actor: Actor = operator) {
    return runtime.submit({ actionId: id("act"), actor, action });
  }

  useEffect(() => {
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

  async function addLocalFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    for (const file of files) {
      const track: Track = {
        id: id("track"),
        title: file.name.replace(/\.[^.]+$/, ""),
        source: URL.createObjectURL(file),
        sourceType: "local",
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
      } catch {
        setNotice("Could not remove the durable media record");
        return;
      }
    }
    submit({ type: "REMOVE_TRACK", trackId });
  }

  function botPick() {
    if (!tracks.length) return;
    const choice = tracks[Math.floor(Math.random() * tracks.length)];
    if (choice) submit({ type: "ENQUEUE_TRACK", trackId: choice.id }, agent);
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">LOCAL-FIRST / AGENT-NATIVE / PERSISTENT</p>
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
          <div className="record-core">Φ</div>
        </div>
        <div>
          <p className="eyebrow">NOW PLAYING</p>
          <h2>{current?.title ?? "Nothing loaded"}</h2>
          <p className="muted">{current?.artist ?? (current ? "Unknown artist" : "Feed the machine a track.")}</p>

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
        <span>Crate and room state survive reloads on this browser.</span>
      </div>

      <section className="grid">
        <div className="panel">
          <div className="panel-head">
            <h3>CRATE</h3>
            <span>{tracks.length} TRACK{tracks.length === 1 ? "" : "S"}</span>
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
            {tracks.length ? (
              tracks.map((track) => (
                <div className="row" key={track.id}>
                  <div className="track-copy">
                    <strong>{track.title}</strong>
                    <small>{track.artist ?? track.sourceType.toUpperCase()}</small>
                  </div>
                  <div className="row-actions">
                    <button onClick={() => submit({ type: "ENQUEUE_TRACK", trackId: track.id })}>
                      QUEUE
                    </button>
                    <button className="danger" onClick={() => void removeTrack(track.id)}>
                      REMOVE
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="empty">No tracks yet. The jukebox is judging the silence.</p>
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

          <div className="list">
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
        </div>

        <div className="panel ledger-panel">
          <div className="panel-head">
            <h3>REALITY LEDGER</h3>
            <span>{receipts.length} RECEIPT{receipts.length === 1 ? "" : "S"}</span>
          </div>
          <div className="ledger">
            {receipts.length ? (
              receipts.slice(-16).reverse().map((receipt) => (
                <div className={`receipt ${receipt.accepted ? "ok" : "no"}`} key={receipt.receiptId}>
                  <span>#{receipt.seq}</span>
                  <strong>{receipt.actor.role.toUpperCase()} · {receipt.action.type}</strong>
                  <code>{receipt.receiptId}</code>
                </div>
              ))
            ) : (
              <p className="empty">No actions yet.</p>
            )}
          </div>
        </div>
      </section>

      <footer>
        <span>React deck · IndexedDB crate · governed Action Bus</span>
        <span>Local audio stays in this browser. Remote URLs remain remote.</span>
      </footer>
    </main>
  );
}
