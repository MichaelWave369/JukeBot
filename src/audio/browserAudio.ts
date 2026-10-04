import type { RoomState } from "../core/types";

export class BrowserAudioAdapter {
  private readonly audio = new Audio();
  private loadedTrackId: string | null = null;
  private lastTransport: RoomState["transport"] = "stopped";
  private onEnded: (() => void) | null = null;

  constructor() {
    this.audio.preload = "metadata";
    this.audio.addEventListener("ended", () => this.onEnded?.());
  }

  setEndedHandler(handler: () => void): void {
    this.onEnded = handler;
  }

  async sync(state: RoomState): Promise<void> {
    const track = state.currentTrackId ? state.tracks[state.currentTrackId] : undefined;
    this.audio.volume = state.volume;

    if (!track) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.loadedTrackId = null;
      this.lastTransport = state.transport;
      return;
    }

    if (this.loadedTrackId !== track.id) {
      this.audio.src = track.source;
      this.loadedTrackId = track.id;
      this.audio.load();
    }

    if (state.transport === "playing" && this.lastTransport !== "playing") {
      try {
        await this.audio.play();
      } catch {
        // Browser autoplay policy may require the operator to press play.
      }
    } else if (state.transport !== "playing") {
      this.audio.pause();
      if (state.transport === "stopped") this.audio.currentTime = 0;
    }

    this.lastTransport = state.transport;
  }
}
