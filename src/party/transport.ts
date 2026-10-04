import type {
  PartyTransportProfile,
  PartyTransportStrategy,
  PartyTurnServer,
} from "./types";

export interface TransportDiagnostic {
  id:
    | "secure-context"
    | "webrtc"
    | "webcrypto"
    | "websocket"
    | "online"
    | "relay-profile"
    | "turn-profile";
  status: "pass" | "warn" | "fail";
  label: string;
  detail: string;
}

export interface JoinIssue {
  kind: "turn-likely" | "password" | "offline" | "relay" | "generic";
  message: string;
  suggestion: string;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeRelayUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "wss:" && url.protocol !== "ws:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeTurnUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^turns?:[^\s]+$/i.test(trimmed)) return trimmed;
  return null;
}

function normalizeTurnServer(server: PartyTurnServer): PartyTurnServer | null {
  const urls = unique(
    (server.urls ?? [])
      .map(normalizeTurnUrl)
      .filter((value): value is string => Boolean(value)),
  );

  if (!urls.length) return null;

  const username = server.username?.trim() || undefined;
  const credential = server.credential?.trim() || undefined;

  return {
    urls,
    username,
    credential,
  };
}

export function normalizeTransportProfile(
  profile?: PartyTransportProfile,
): PartyTransportProfile {
  const strategy: PartyTransportStrategy =
    profile?.strategy === "ws-relay" ? "ws-relay" : "nostr";

  const relayUrls = unique(
    (profile?.relayUrls ?? [])
      .map(normalizeRelayUrl)
      .filter((value): value is string => Boolean(value)),
  );

  const relayRedundancy = Math.max(
    1,
    Math.min(10, Math.round(profile?.relayRedundancy ?? 5)),
  );

  const turn = (profile?.turn ?? [])
    .map(normalizeTurnServer)
    .filter((value): value is PartyTurnServer => Boolean(value));

  return {
    version: 1,
    strategy,
    relayUrls: relayUrls.length ? relayUrls : undefined,
    relayRedundancy:
      strategy === "nostr" && !relayUrls.length ? relayRedundancy : undefined,
    turn: turn.length ? turn : undefined,
  };
}

export function transportProfileFromInputs(input: {
  strategy: PartyTransportStrategy;
  relayUrls: string;
  relayRedundancy: number;
  turnUrl: string;
  turnUsername: string;
  turnCredential: string;
}): PartyTransportProfile {
  const relayUrls = input.relayUrls
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  const turnUrls = input.turnUrl
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return normalizeTransportProfile({
    version: 1,
    strategy: input.strategy,
    relayUrls,
    relayRedundancy: input.relayRedundancy,
    turn: turnUrls.length
      ? [
          {
            urls: turnUrls,
            username: input.turnUsername || undefined,
            credential: input.turnCredential || undefined,
          },
        ]
      : undefined,
  });
}

export function controlledRelayReady(
  profile?: PartyTransportProfile,
): boolean {
  const normalized = normalizeTransportProfile(profile);
  return (
    normalized.strategy !== "ws-relay" ||
    Boolean(normalized.relayUrls?.length)
  );
}

export function transportProfileLabel(
  profile?: PartyTransportProfile,
): string {
  const normalized = normalizeTransportProfile(profile);

  const relay =
    normalized.strategy === "ws-relay"
      ? normalized.relayUrls?.length
        ? `controlled WS ×${normalized.relayUrls.length}`
        : "controlled WS · missing URL"
      : normalized.relayUrls?.length
        ? `${normalized.relayUrls.length} custom Nostr relay${normalized.relayUrls.length === 1 ? "" : "s"}`
        : `default Nostr ×${normalized.relayRedundancy ?? 5}`;

  const turn = normalized.turn?.length
    ? `TURN ${normalized.turn.length}`
    : "direct/STUN";

  return `${relay} · ${turn}`;
}

export function collectTransportDiagnostics(
  profile?: PartyTransportProfile,
): TransportDiagnostic[] {
  const normalized = normalizeTransportProfile(profile);
  const secure =
    typeof window !== "undefined"
      ? window.isSecureContext
      : true;

  const hasWebRtc = typeof RTCPeerConnection !== "undefined";
  const hasCrypto =
    typeof crypto !== "undefined" && Boolean(crypto.subtle);
  const hasWebSocket = typeof WebSocket !== "undefined";
  const online =
    typeof navigator === "undefined" ? true : navigator.onLine;

  const relayReady = controlledRelayReady(normalized);

  return [
    {
      id: "secure-context",
      status: secure ? "pass" : "fail",
      label: "Secure context",
      detail: secure
        ? "HTTPS/secure browser context available"
        : "WebRTC room encryption requires a secure context",
    },
    {
      id: "webrtc",
      status: hasWebRtc ? "pass" : "fail",
      label: "WebRTC",
      detail: hasWebRtc
        ? "RTCPeerConnection is available"
        : "This browser does not expose RTCPeerConnection",
    },
    {
      id: "webcrypto",
      status: hasCrypto ? "pass" : "fail",
      label: "Web Crypto",
      detail: hasCrypto
        ? "Crypto primitives are available"
        : "Web Crypto is unavailable",
    },
    {
      id: "websocket",
      status: hasWebSocket ? "pass" : "fail",
      label: "WebSocket",
      detail: hasWebSocket
        ? "Relay signaling can use WebSocket"
        : "WebSocket API is unavailable",
    },
    {
      id: "online",
      status: online ? "pass" : "warn",
      label: "Browser online",
      detail: online
        ? "Browser reports network connectivity"
        : "Browser currently reports offline",
    },
    {
      id: "relay-profile",
      status: relayReady ? "pass" : "fail",
      label: "Signaling",
      detail:
        normalized.strategy === "ws-relay"
          ? normalized.relayUrls?.length
            ? `Controlled WebSocket relay: ${normalized.relayUrls.join(", ")}`
            : "Controlled relay mode requires at least one ws:// or wss:// URL"
          : normalized.relayUrls?.length
            ? `${normalized.relayUrls.length} custom Nostr relay URL(s)`
            : `Trystero default Nostr relays, redundancy ${normalized.relayRedundancy ?? 5}`,
    },
    {
      id: "turn-profile",
      status: normalized.turn?.length ? "pass" : "warn",
      label: "TURN fallback",
      detail: normalized.turn?.length
        ? `${normalized.turn.length} TURN server profile(s) supplied`
        : "No TURN fallback configured; restrictive NAT/firewalls may fail",
    },
  ];
}

export function classifyJoinIssue(message: string): JoinIssue {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("websocket") ||
    normalized.includes("relay") ||
    normalized.includes("socket")
  ) {
    return {
      kind: "relay",
      message,
      suggestion:
        "The signaling relay could not be reached. Verify the ws/wss URL, TLS certificate, and relay process.",
    };
  }

  if (
    normalized.includes("ice") ||
    normalized.includes("webrtc") ||
    normalized.includes("connection") ||
    normalized.includes("timeout")
  ) {
    return {
      kind: "turn-likely",
      message,
      suggestion:
        "Direct WebRTC could not establish. Try an ephemeral TURN profile or a less restrictive network.",
    };
  }

  if (
    normalized.includes("password") ||
    normalized.includes("decrypt") ||
    normalized.includes("handshake")
  ) {
    return {
      kind: "password",
      message,
      suggestion:
        "The invite key or handshake did not match. Re-scan the current host QR.",
    };
  }

  if (normalized.includes("offline") || normalized.includes("network")) {
    return {
      kind: "offline",
      message,
      suggestion:
        "Check connectivity, then reconnect using the same invite.",
    };
  }

  return {
    kind: "generic",
    message,
    suggestion:
      "Reconnect once. If it repeats, inspect transport diagnostics and add TURN if direct WebRTC is blocked.",
  };
}
