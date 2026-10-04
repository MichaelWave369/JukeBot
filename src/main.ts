import "./styles.css";
import { BrowserAudioAdapter } from "./audio/browserAudio";
import { JukeRuntime } from "./core/runtime";
import type { Actor, JukeAction, Track } from "./core/types";

declare global {
  interface Window {
    JukeBot: {
      observe: () => ReturnType<JukeRuntime["observe"]>;
      ledger: () => ReturnType<JukeRuntime["ledger"]>;
      submit: (action: JukeAction, actor?: Actor) => ReturnType<JukeRuntime["submit"]>;
    };
  }
}

const runtime = new JukeRuntime();
const audio = new BrowserAudioAdapter();

const operator: Actor = { id: "operator.local", role: "operator", label: "Operator" };
const agent: Actor = { id: "jukebot.local", role: "agent", label: "JukeBot" };

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function submit(action: JukeAction, actor: Actor = operator) {
  return runtime.submit({ actionId: id("act"), actor, action });
}

window.JukeBot = {
  observe: () => runtime.observe(),
  ledger: () => runtime.ledger(),
  submit,
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app");

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">LOCAL-FIRST / AGENT-NATIVE / RECEIPTED</p>
        <h1>JukeBot</h1>
        <p class="tagline">A jukebox where humans, bots, scripts and peers use the same controls.</p>
      </div>
      <div class="status" id="status">ROOM READY</div>
    </header>

    <section class="now panel">
      <div class="record">
        <div class="record-core">Φ</div>
      </div>
      <div>
        <p class="eyebrow">NOW PLAYING</p>
        <h2 id="now-title">Nothing loaded</h2>
        <p id="now-artist">Feed the machine a track.</p>
        <div class="transport">
          <button data-action="PLAY">PLAY</button>
          <button data-action="PAUSE">PAUSE</button>
          <button data-action="SKIP">SKIP</button>
          <button data-action="STOP">STOP</button>
        </div>
        <label class="volume">VOLUME <input id="volume" type="range" min="0" max="1" step="0.01" value="0.82"></label>
      </div>
    </section>

    <section class="grid">
      <div class="panel">
        <div class="panel-head"><h3>CRATE</h3><span id="crate-count">0 TRACKS</span></div>
        <label class="file-pick">ADD LOCAL AUDIO<input id="file-input" type="file" accept="audio/*" multiple hidden></label>
        <div class="url-add">
          <input id="url-input" placeholder="Direct audio URL">
          <button id="url-button">ADD URL</button>
        </div>
        <div id="crate" class="list"></div>
      </div>

      <div class="panel">
        <div class="panel-head"><h3>UP NEXT</h3><button id="bot-pick">BOT PICK</button></div>
        <div id="queue" class="list"></div>
      </div>

      <div class="panel ledger-panel">
        <div class="panel-head"><h3>REALITY LEDGER</h3><span id="receipt-count">0 RECEIPTS</span></div>
        <div id="ledger" class="ledger"></div>
      </div>
    </section>

    <footer>
      <span>window.JukeBot is live for agent/script control.</span>
      <span>Audio stays in your browser unless you add a remote URL.</span>
    </footer>
  </main>
`;

const nowTitle = document.querySelector<HTMLElement>("#now-title")!;
const nowArtist = document.querySelector<HTMLElement>("#now-artist")!;
const status = document.querySelector<HTMLElement>("#status")!;
const crate = document.querySelector<HTMLElement>("#crate")!;
const queue = document.querySelector<HTMLElement>("#queue")!;
const ledger = document.querySelector<HTMLElement>("#ledger")!;
const crateCount = document.querySelector<HTMLElement>("#crate-count")!;
const receiptCount = document.querySelector<HTMLElement>("#receipt-count")!;
const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const urlInput = document.querySelector<HTMLInputElement>("#url-input")!;
const volume = document.querySelector<HTMLInputElement>("#volume")!;

function trackLabel(track: Track | undefined): string {
  return track ? track.title : "Unknown track";
}

function render(): void {
  const state = runtime.observe();
  const current = state.currentTrackId ? state.tracks[state.currentTrackId] : undefined;
  const tracks = Object.values(state.tracks);
  const receipts = runtime.ledger();

  nowTitle.textContent = current?.title ?? "Nothing loaded";
  nowArtist.textContent = current?.artist ?? (current ? "Unknown artist" : "Feed the machine a track.");
  status.textContent = state.transport.toUpperCase();
  volume.value = String(state.volume);
  crateCount.textContent = `${tracks.length} TRACK${tracks.length === 1 ? "" : "S"}`;
  receiptCount.textContent = `${receipts.length} RECEIPT${receipts.length === 1 ? "" : "S"}`;

  crate.innerHTML = tracks.length
    ? tracks.map((track) => `
        <div class="row">
          <div><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist ?? track.sourceType)}</small></div>
          <button data-enqueue="${track.id}">QUEUE</button>
        </div>`).join("")
    : '<p class="empty">No tracks yet.</p>';

  queue.innerHTML = state.queue.length
    ? state.queue.map((trackId, index) => `
        <div class="row">
          <div><strong>${index + 1}. ${escapeHtml(trackLabel(state.tracks[trackId]))}</strong></div>
          <button data-remove="${index}">×</button>
        </div>`).join("")
    : '<p class="empty">Queue is empty.</p>';

  ledger.innerHTML = receipts.length
    ? receipts.slice(-12).reverse().map((receipt) => `
        <div class="receipt ${receipt.accepted ? "ok" : "no"}">
          <span>#${receipt.seq}</span>
          <strong>${receipt.actor.role.toUpperCase()} · ${receipt.action.type}</strong>
          <code>${receipt.receiptId}</code>
        </div>`).join("")
    : '<p class="empty">No actions yet.</p>';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char] ?? char);
}

runtime.subscribe((state) => {
  void audio.sync(state);
  render();
});

audio.setEndedHandler(() => submit({ type: "SKIP" }, agent));

document.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((button) => {
  button.addEventListener("click", () => submit({ type: button.dataset.action as "PLAY" | "PAUSE" | "SKIP" | "STOP" }));
});

crate.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-enqueue]");
  if (button?.dataset.enqueue) submit({ type: "ENQUEUE_TRACK", trackId: button.dataset.enqueue });
});

queue.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove]");
  if (button?.dataset.remove) submit({ type: "REMOVE_FROM_QUEUE", index: Number(button.dataset.remove) });
});

fileInput.addEventListener("change", () => {
  for (const file of Array.from(fileInput.files ?? [])) {
    const track: Track = {
      id: id("track"),
      title: file.name.replace(/\.[^.]+$/, ""),
      source: URL.createObjectURL(file),
      sourceType: "local",
    };
    submit({ type: "ADD_TRACK", track });
  }
  fileInput.value = "";
});

document.querySelector("#url-button")?.addEventListener("click", () => {
  const source = urlInput.value.trim();
  if (!source) return;
  const fallbackTitle = source.split("/").pop()?.split("?")[0] || "Remote track";
  submit({
    type: "ADD_TRACK",
    track: { id: id("track"), title: decodeURIComponent(fallbackTitle), source, sourceType: "url" },
  });
  urlInput.value = "";
});

document.querySelector("#bot-pick")?.addEventListener("click", () => {
  const tracks = Object.values(runtime.observe().tracks);
  if (!tracks.length) return;
  const choice = tracks[Math.floor(Math.random() * tracks.length)];
  if (choice) submit({ type: "ENQUEUE_TRACK", trackId: choice.id }, agent);
});

volume.addEventListener("input", () => submit({ type: "SET_VOLUME", volume: Number(volume.value) }));

render();
