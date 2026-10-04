import { describe, expect, it } from "vitest";
import {
  buildPartyInviteUrl,
  parsePartyInviteUrl,
} from "../src/party/invite";
import {
  buildPartyCatalog,
  buildPartySnapshot,
  PartyHostEngine,
} from "../src/party/protocol";
import type {
  PartyGuestRequest,
  PartyInvite,
} from "../src/party/types";
import type { RoomState, SunoPlaylist } from "../src/core/types";

const room: RoomState = {
  roomId: "local-room",
  seq: 7,
  transport: "playing",
  currentTrackId: "native-a",
  queue: ["native-b"],
  tracks: {
    "native-a": {
      id: "native-a",
      title: "Late on the One",
      artist: "Field Unit",
      source: "blob:https://jukebot.example/private-local-url",
      sourceType: "local",
    },
    "native-b": {
      id: "native-b",
      title: "Direct Track",
      source: "https://audio.example/secret-path.mp3",
      sourceType: "url",
    },
  },
  volume: 0.82,
  repeat: "off",
};

const suno: SunoPlaylist = {
  id: "suno-set",
  name: "Suno Set",
  playlistUrl: "https://suno.com/playlist/11111111-1111-4111-8111-111111111111",
  tracks: [
    {
      songId: "22222222-2222-4222-8222-222222222222",
      title: "Hosted Funk",
      songUrl: "https://suno.com/song/22222222-2222-4222-8222-222222222222",
    },
  ],
  createdAt: "fixed",
  updatedAt: "fixed",
};

function request(overrides: Partial<PartyGuestRequest> = {}): PartyGuestRequest {
  const catalog = buildPartyCatalog(room, [suno]);
  return {
    protocol: "jukebot.party.v1",
    requestId: "req-1",
    guestName: "Phone Guest",
    catalogHash: catalog.hash,
    selection: {
      kind: "native",
      trackId: "native-b",
    },
    sentAt: "fixed",
    ...overrides,
  };
}

describe("Party invite", () => {
  it("keeps the room password in the URL fragment rather than query params", () => {
    const invite: PartyInvite = {
      protocol: "jukebot.party.v1",
      roomId: "room123",
      hostPeerId: "host456",
      password: "super-secret-room-key",
    };

    const url = buildPartyInviteUrl(
      invite,
      "https://michaelwave369.github.io/JukeBot/",
    );

    const parsedUrl = new URL(url);
    expect(parsedUrl.searchParams.get("party")).toBe("room123");
    expect(parsedUrl.searchParams.get("host")).toBe("host456");
    expect(parsedUrl.searchParams.has("key")).toBe(false);
    expect(parsedUrl.hash).toContain("key=super-secret-room-key");

    expect(parsePartyInviteUrl(url)).toEqual({
      roomId: "room123",
      hostPeerId: "host456",
      password: "super-secret-room-key",
    });
  });
});

describe("Party safe catalog", () => {
  it("publishes requestable metadata without leaking native media URLs", () => {
    const snapshot = buildPartySnapshot(room, [suno], "host-peer", "fixed");
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.catalog).toHaveLength(3);
    expect(serialized).not.toContain("blob:https://");
    expect(serialized).not.toContain("audio.example");
    expect(serialized).not.toContain("suno.com/song");
    expect(snapshot.catalog.some((item) => item.kind === "suno")).toBe(true);
    expect(snapshot.queue).toEqual([
      { trackId: "native-b", title: "Direct Track" },
    ]);
  });

  it("keeps native and Suno identities in separate namespaces", () => {
    const catalog = buildPartyCatalog(room, [suno]);
    const native = catalog.items.find((item) => item.kind === "native");
    const hosted = catalog.items.find((item) => item.kind === "suno");

    expect(native?.kind).toBe("native");
    expect(hosted?.kind).toBe("suno");
  });
});

describe("Party host request engine", () => {
  it("deduplicates a reconnect retry with the same request ID and content", () => {
    const engine = new PartyHostEngine();
    const catalog = buildPartyCatalog(room, [suno]);
    const first = engine.ingest(request(), "peer-a", catalog, "t1");
    const retry = engine.ingest(request(), "peer-a", catalog, "t2");

    expect(first.status).toBe("new");
    expect(retry.status).toBe("duplicate");
    expect(engine.pending()).toHaveLength(1);
  });

  it("refuses request-ID reuse with different content", () => {
    const engine = new PartyHostEngine();
    const catalog = buildPartyCatalog(room, [suno]);

    engine.ingest(request(), "peer-a", catalog, "t1");
    const conflict = engine.ingest(
      request({
        selection: {
          kind: "suno",
          playlistId: "suno-set",
          songId: "22222222-2222-4222-8222-222222222222",
        },
      }),
      "peer-a",
      catalog,
      "t2",
    );

    expect(conflict.status).toBe("conflict");
    expect(engine.pending()).toHaveLength(1);
  });

  it("rejects stale catalog requests before they become pending", () => {
    const engine = new PartyHostEngine();
    const catalog = buildPartyCatalog(room, [suno]);

    const result = engine.ingest(
      request({ catalogHash: "stale-hash" }),
      "peer-a",
      catalog,
      "t1",
    );

    expect(result.status).toBe("stale");
    expect(engine.pending()).toEqual([]);
  });

  it("records accepted and refused host decisions exactly once", () => {
    const engine = new PartyHostEngine();
    const catalog = buildPartyCatalog(room, [suno]);

    engine.ingest(request(), "peer-a", catalog, "t1");
    const accepted = engine.decide("req-1", "accepted", {
      effectReceiptId: "native-receipt",
      decidedAt: "t2",
    });
    const replayedDecision = engine.decide("req-1", "refused", {
      decidedAt: "t3",
    });

    expect(accepted.decision).toBe("accepted");
    expect(replayedDecision).toEqual(accepted);
    expect(engine.ledger()).toHaveLength(1);
    expect(engine.ledger()[0]?.effectReceiptId).toBe("native-receipt");
    expect(engine.pending()).toEqual([]);
  });
});
