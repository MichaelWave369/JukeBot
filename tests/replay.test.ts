import { describe, expect, it } from "vitest";
import { assessBundle, createBundle } from "../src/core/bundle";
import { roomStateHash } from "../src/core/hash";
import { validateReplay } from "../src/core/replay";
import { JukeRuntime } from "../src/core/runtime";
import type { Actor, Receipt, RoomState, Track } from "../src/core/types";

const operator: Actor = { id: "op", role: "operator" };
const agent: Actor = { id: "agent", role: "agent" };

function localTrack(source: string): Track {
  return {
    id: "local-a",
    title: "Local A",
    source,
    sourceType: "local",
    tags: ["live", "funk"],
  };
}

describe("portable room hashing", () => {
  it("ignores ephemeral blob URL changes for the same local media identity", () => {
    const base: RoomState = {
      roomId: "test",
      seq: 1,
      transport: "stopped",
      currentTrackId: null,
      queue: [],
      tracks: { "local-a": localTrack("blob:first-runtime") },
      volume: 0.82,
      repeat: "off",
    };

    const restored: RoomState = {
      ...base,
      tracks: { "local-a": localTrack("blob:second-runtime") },
    };

    expect(roomStateHash(base)).toBe(roomStateHash(restored));
  });

  it("still detects meaningful metadata differences", () => {
    const state: RoomState = {
      roomId: "test",
      seq: 1,
      transport: "stopped",
      currentTrackId: null,
      queue: [],
      tracks: { "local-a": localTrack("blob:first") },
      volume: 0.82,
      repeat: "off",
    };
    const changed: RoomState = {
      ...state,
      tracks: {
        "local-a": {
          ...localTrack("blob:second"),
          title: "Different title",
        },
      },
    };

    expect(roomStateHash(state)).not.toBe(roomStateHash(changed));
  });
});

describe("receipt replay", () => {
  it("reconstructs an all-v2 ledger exactly", () => {
    const runtime = new JukeRuntime("test", () => "fixed");
    const actions = [
      { type: "ADD_TRACK", track: localTrack("blob:runtime") } as const,
      { type: "ENQUEUE_TRACK", trackId: "local-a" } as const,
      { type: "PLAY" } as const,
      {
        type: "UPDATE_TRACK_METADATA",
        trackId: "local-a",
        patch: { artist: "Field Unit", tags: ["funk", "live"] as string[] },
      } as const,
    ];

    actions.forEach((action, index) => {
      runtime.submit({
        actionId: `action-${index}`,
        actor: operator,
        action,
      });
    });

    const report = validateReplay(runtime.ledger(), "test");
    expect(report.status).toBe("EXACT");
    expect(report.checkedV2).toBe(4);
    expect(report.finalHash).toBe(roomStateHash(runtime.observe()));
  });

  it("detects a tampered v2 state hash", () => {
    const runtime = new JukeRuntime("test", () => "fixed");
    runtime.submit({
      actionId: "a1",
      actor: operator,
      action: { type: "ADD_TRACK", track: localTrack("blob:runtime") },
    });

    const receipts = runtime.ledger().map((receipt, index) => (
      index === 0 ? { ...receipt, stateHash: "00000000" } : receipt
    ));

    expect(validateReplay(receipts, "test").status).toBe("MISMATCH");
  });

  it("labels old receipts honestly instead of upgrading them by assumption", () => {
    const legacy: Receipt = {
      receiptId: "legacy",
      seq: 1,
      at: "old",
      actionId: "old-action",
      actor: agent,
      action: { type: "STOP" },
      accepted: true,
      stateHash: "oldhash",
    };

    const report = validateReplay([legacy]);
    expect(report.status).toBe("MIXED_LEGACY");
    expect(report.legacyReceipts).toBe(1);
    expect(report.checkedV2).toBe(0);
  });
});

describe("portable session bundles", () => {
  it("reports local media missing on another device", () => {
    const runtime = new JukeRuntime("test", () => "fixed");
    runtime.submit({
      actionId: "add",
      actor: operator,
      action: { type: "ADD_TRACK", track: localTrack("blob:runtime") },
    });

    const bundle = createBundle(runtime.observe(), runtime.ledger(), [], "fixed");
    const assessment = assessBundle(bundle, []);

    expect(assessment.missingLocalTrackIds).toEqual(["local-a"]);
    expect(assessment.replayStatus).toBe("EXACT");
  });
});
