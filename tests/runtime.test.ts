import { describe, expect, it } from "vitest";
import { JukeRuntime } from "../src/core/runtime";
import type { Actor, JukeAction, Receipt, RoomState, Track } from "../src/core/types";

const operator: Actor = { id: "op", role: "operator" };
const guest: Actor = { id: "guest", role: "guest" };
const agent: Actor = { id: "agent", role: "agent" };

const trackA: Track = { id: "a", title: "A", source: "a.mp3", sourceType: "url" };
const trackB: Track = { id: "b", title: "B", source: "b.mp3", sourceType: "url" };

function submit(runtime: JukeRuntime, actor: Actor, action: JukeAction, n = 1) {
  return runtime.submit({ actionId: `action-${n}`, actor, action });
}

describe("JukeRuntime", () => {
  it("moves queued audio into now playing through the shared action bus", () => {
    const runtime = new JukeRuntime("test", () => "2026-10-03T00:00:00.000Z");
    submit(runtime, operator, { type: "ADD_TRACK", track: trackA }, 1);
    submit(runtime, operator, { type: "ENQUEUE_TRACK", trackId: "a" }, 2);
    submit(runtime, operator, { type: "PLAY" }, 3);

    expect(runtime.observe().currentTrackId).toBe("a");
    expect(runtime.observe().transport).toBe("playing");
    expect(runtime.observe().queue).toEqual([]);
  });

  it("allows guests to request songs but refuses transport authority", () => {
    const runtime = new JukeRuntime();
    submit(runtime, operator, { type: "ADD_TRACK", track: trackA }, 1);
    const queued = submit(runtime, guest, { type: "ENQUEUE_TRACK", trackId: "a" }, 2);
    const play = submit(runtime, guest, { type: "PLAY" }, 3);

    expect(queued.receipt.accepted).toBe(true);
    expect(play.receipt.accepted).toBe(false);
    expect(runtime.observe().transport).toBe("stopped");
  });

  it("lets an agent operate transport but not master volume", () => {
    const runtime = new JukeRuntime();
    submit(runtime, operator, { type: "ADD_TRACK", track: trackA }, 1);
    submit(runtime, operator, { type: "ENQUEUE_TRACK", trackId: "a" }, 2);

    expect(submit(runtime, agent, { type: "PLAY" }, 3).receipt.accepted).toBe(true);
    expect(submit(runtime, agent, { type: "SET_VOLUME", volume: 0.1 }, 4).receipt.accepted).toBe(false);
    expect(runtime.observe().volume).toBe(0.82);
  });

  it("skips deterministically to the next queued track", () => {
    const runtime = new JukeRuntime();
    for (const [n, track] of [trackA, trackB].entries()) {
      submit(runtime, operator, { type: "ADD_TRACK", track }, n + 1);
      submit(runtime, operator, { type: "ENQUEUE_TRACK", trackId: track.id }, n + 10);
    }
    submit(runtime, operator, { type: "PLAY" }, 20);
    submit(runtime, agent, { type: "SKIP" }, 21);

    expect(runtime.observe().currentTrackId).toBe("b");
    expect(runtime.observe().transport).toBe("playing");
  });

  it("emits a receipt for accepted and refused actions", () => {
    const runtime = new JukeRuntime("test", () => "fixed-time");
    submit(runtime, operator, { type: "ADD_TRACK", track: trackA }, 1);
    submit(runtime, guest, { type: "STOP" }, 2);

    const receipts = runtime.ledger();
    expect(receipts).toHaveLength(2);
    expect(receipts[0]?.stateHash).toMatch(/^[0-9a-f]{8}$/);
    expect(receipts[1]?.accepted).toBe(false);
    expect(receipts[1]?.reason).toContain("not authorized");
  });

  it("hydrates a previously persisted room and ledger without creating fake actions", () => {
    const restoredState: RoomState = {
      roomId: "restored",
      seq: 42,
      transport: "stopped",
      currentTrackId: "a",
      queue: ["b"],
      tracks: { a: trackA, b: trackB },
      volume: 0.55,
      repeat: "all",
    };
    const restoredReceipt: Receipt = {
      receiptId: "deadbeef",
      seq: 42,
      at: "saved-time",
      actionId: "saved-action",
      actor: operator,
      action: { type: "PLAY" },
      accepted: true,
      stateHash: "cafebabe",
    };

    const runtime = new JukeRuntime(
      "ignored",
      () => "new-time",
      restoredState,
      [restoredReceipt],
    );

    expect(runtime.observe()).toEqual(restoredState);
    expect(runtime.ledger()).toEqual([restoredReceipt]);
  });

  it("lets only privileged human seats delete durable crate entries", () => {
    const runtime = new JukeRuntime();
    submit(runtime, operator, { type: "ADD_TRACK", track: trackA }, 1);
    submit(runtime, operator, { type: "ADD_TRACK", track: trackB }, 2);
    submit(runtime, operator, { type: "ENQUEUE_TRACK", trackId: "a" }, 3);
    submit(runtime, operator, { type: "PLAY" }, 4);

    const refused = submit(runtime, agent, { type: "REMOVE_TRACK", trackId: "a" }, 5);
    expect(refused.receipt.accepted).toBe(false);
    expect(runtime.observe().tracks.a).toBeDefined();

    const removed = submit(runtime, operator, { type: "REMOVE_TRACK", trackId: "a" }, 6);
    expect(removed.receipt.accepted).toBe(true);
    expect(runtime.observe().tracks.a).toBeUndefined();
    expect(runtime.observe().currentTrackId).toBeNull();
    expect(runtime.observe().transport).toBe("stopped");
  });
});
