import type { PartyTransportProfile } from "./types";
import { normalizeTransportProfile } from "./transport";

export type QualificationScenarioId =
  | "lan_nostr"
  | "cellular_nostr"
  | "controlled_relay"
  | "turn_fallback"
  | "reconnect_idempotency"
  | "multi_guest"
  | "native_ledger_link"
  | "suno_hosted"
  | "host_restart_rejoin";

export type QualificationScenarioStatus =
  | "NOT_RUN"
  | "PASS"
  | "FAIL"
  | "BLOCKED";

export type QualificationOverall =
  | "FIELD_QUALIFIED"
  | "PARTIAL"
  | "FAIL";

export interface QualificationObservations {
  roomStartCount: number;
  roomStopCount: number;
  peerJoinCount: number;
  peerLeaveCount: number;
  maxConcurrentPeers: number;
  duplicateRequestCount: number;
  staleRequestCount: number;
  conflictRequestCount: number;
  unknownRequestCount: number;
  joinErrorCount: number;
  acceptedRequestCount: number;
  refusedRequestCount: number;
  nativeEffectLinkedCount: number;
  sunoAcceptedCount: number;
}

export interface QualificationEnvironment {
  secureContext: boolean;
  webRtcAvailable: boolean;
  webCryptoAvailable: boolean;
  webSocketAvailable: boolean;
  online: boolean;
}

export interface QualificationTransportEvidence {
  strategy: "nostr" | "ws-relay";
  relayCount: number;
  defaultRelayRedundancy?: number;
  turnConfigured: boolean;
  turnServerCount: number;
}

export interface QualificationEvidenceSnapshot {
  capturedAt: string;
  transport: QualificationTransportEvidence;
  environment: QualificationEnvironment;
  observations: QualificationObservations;
}

export interface QualificationScenarioResult {
  id: QualificationScenarioId;
  status: QualificationScenarioStatus;
  notes: string;
  updatedAt?: string;
  evidence?: QualificationEvidenceSnapshot;
}

export interface PartyQualificationBundle {
  schema: "jukebot.party.qualification.v1";
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  overall: QualificationOverall;
  scenarios: QualificationScenarioResult[];
}

export interface QualificationScenarioDefinition {
  id: QualificationScenarioId;
  title: string;
  instruction: string;
  requiredEvidence: string;
}

export const QUALIFICATION_SCENARIOS: QualificationScenarioDefinition[] = [
  {
    id: "lan_nostr",
    title: "Same-LAN Nostr",
    instruction:
      "Host on the PC and join from a second physical device on the same local network using Nostr signaling.",
    requiredEvidence:
      "Guest connects, receives the safe catalog, submits a request, and host receives it.",
  },
  {
    id: "cellular_nostr",
    title: "Cellular / WAN Nostr",
    instruction:
      "Move the guest phone off Wi-Fi onto cellular/WAN and join a fresh Nostr Party invite.",
    requiredEvidence:
      "Guest reaches the host across distinct network paths and a request arrives.",
  },
  {
    id: "controlled_relay",
    title: "Controlled WS Relay",
    instruction:
      "Run Party Room with CONTROLLED WS RELAY and a deployed ws/wss relay endpoint.",
    requiredEvidence:
      "Both devices join through the controlled strategy and complete a request round trip.",
  },
  {
    id: "turn_fallback",
    title: "TURN Fallback",
    instruction:
      "Use a restrictive path or relay policy where direct WebRTC is unavailable and qualify with TURN configured.",
    requiredEvidence:
      "Party communication succeeds with a TURN profile present; record the network condition in notes.",
  },
  {
    id: "reconnect_idempotency",
    title: "Disconnect / Reconnect Idempotency",
    instruction:
      "Submit a request, interrupt the guest connection before resolution, reconnect, and let JukeBot retry the unresolved request.",
    requiredEvidence:
      "At least one peer leave and one duplicate request retry are observed without a second pending request.",
  },
  {
    id: "multi_guest",
    title: "Multiple Simultaneous Guests",
    instruction:
      "Join at least two physical guest clients at the same time.",
    requiredEvidence:
      "Host observes two or more simultaneous peers and can distinguish/request from both.",
  },
  {
    id: "native_ledger_link",
    title: "Native Reality Ledger Link",
    instruction:
      "Request a native track from a guest and ACCEPT it on the host.",
    requiredEvidence:
      "The accepted Party receipt contains an effect receipt ID from the native Reality Ledger.",
  },
  {
    id: "suno_hosted",
    title: "Suno Hosted Source Lane",
    instruction:
      "Request a persisted Suno source from a guest and ACCEPT it.",
    requiredEvidence:
      "Host selects the requested Suno source without fabricating a native playback receipt.",
  },
  {
    id: "host_restart_rejoin",
    title: "Host Stop / Restart / Rejoin",
    instruction:
      "Stop the Party Room, create a new room, and join again from a physical guest.",
    requiredEvidence:
      "A stop and subsequent new start are observed and the guest joins the new invite.",
  },
];

export function emptyQualificationObservations(): QualificationObservations {
  return {
    roomStartCount: 0,
    roomStopCount: 0,
    peerJoinCount: 0,
    peerLeaveCount: 0,
    maxConcurrentPeers: 0,
    duplicateRequestCount: 0,
    staleRequestCount: 0,
    conflictRequestCount: 0,
    unknownRequestCount: 0,
    joinErrorCount: 0,
    acceptedRequestCount: 0,
    refusedRequestCount: 0,
    nativeEffectLinkedCount: 0,
    sunoAcceptedCount: 0,
  };
}

export function captureQualificationEnvironment(): QualificationEnvironment {
  return {
    secureContext:
      typeof window === "undefined" ? true : window.isSecureContext,
    webRtcAvailable: typeof RTCPeerConnection !== "undefined",
    webCryptoAvailable:
      typeof crypto !== "undefined" && Boolean(crypto.subtle),
    webSocketAvailable: typeof WebSocket !== "undefined",
    online: typeof navigator === "undefined" ? true : navigator.onLine,
  };
}

export function safeTransportEvidence(
  profile?: PartyTransportProfile,
): QualificationTransportEvidence {
  const normalized = normalizeTransportProfile(profile);

  return {
    strategy: normalized.strategy ?? "nostr",
    relayCount: normalized.relayUrls?.length ?? 0,
    defaultRelayRedundancy: normalized.relayRedundancy,
    turnConfigured: Boolean(normalized.turn?.length),
    turnServerCount: normalized.turn?.length ?? 0,
  };
}

export function captureQualificationEvidence(
  profile: PartyTransportProfile | undefined,
  observations: QualificationObservations,
  now = new Date().toISOString(),
): QualificationEvidenceSnapshot {
  return {
    capturedAt: now,
    transport: safeTransportEvidence(profile),
    environment: captureQualificationEnvironment(),
    observations: { ...observations },
  };
}

export function createQualificationSession(
  now = new Date().toISOString(),
  sessionId = `qualification-${crypto.randomUUID()}`,
): PartyQualificationBundle {
  return {
    schema: "jukebot.party.qualification.v1",
    sessionId,
    createdAt: now,
    updatedAt: now,
    overall: "PARTIAL",
    scenarios: QUALIFICATION_SCENARIOS.map((scenario) => ({
      id: scenario.id,
      status: "NOT_RUN",
      notes: "",
    })),
  };
}

export function scenarioPassEvidenceSatisfied(
  id: QualificationScenarioId,
  evidence?: QualificationEvidenceSnapshot,
): boolean {
  if (!evidence) return false;

  const { transport, observations } = evidence;

  switch (id) {
    case "lan_nostr":
    case "cellular_nostr":
      return transport.strategy === "nostr" && observations.peerJoinCount >= 1;
    case "controlled_relay":
      return (
        transport.strategy === "ws-relay" &&
        transport.relayCount >= 1 &&
        observations.peerJoinCount >= 1
      );
    case "turn_fallback":
      return transport.turnConfigured && observations.peerJoinCount >= 1;
    case "reconnect_idempotency":
      return (
        observations.peerLeaveCount >= 1 &&
        observations.peerJoinCount >= 2 &&
        observations.duplicateRequestCount >= 1
      );
    case "multi_guest":
      return observations.maxConcurrentPeers >= 2;
    case "native_ledger_link":
      return observations.nativeEffectLinkedCount >= 1;
    case "suno_hosted":
      return observations.sunoAcceptedCount >= 1;
    case "host_restart_rejoin":
      return (
        observations.roomStartCount >= 2 &&
        observations.roomStopCount >= 1 &&
        observations.peerJoinCount >= 2
      );
  }
}

export function assessQualification(
  scenarios: QualificationScenarioResult[],
): QualificationOverall {
  if (
    scenarios.some(
      (scenario) =>
        scenario.status === "FAIL" ||
        (scenario.status === "PASS" &&
          !scenarioPassEvidenceSatisfied(scenario.id, scenario.evidence)),
    )
  ) {
    return "FAIL";
  }

  if (
    scenarios.length === QUALIFICATION_SCENARIOS.length &&
    scenarios.every((scenario) => scenario.status === "PASS")
  ) {
    return "FIELD_QUALIFIED";
  }

  return "PARTIAL";
}

export function updateQualificationScenario(
  bundle: PartyQualificationBundle,
  id: QualificationScenarioId,
  patch: {
    status?: QualificationScenarioStatus;
    notes?: string;
    evidence?: QualificationEvidenceSnapshot;
  },
  now = new Date().toISOString(),
): PartyQualificationBundle {
  const scenarios = bundle.scenarios.map((scenario) =>
    scenario.id === id
      ? {
          ...scenario,
          ...patch,
          updatedAt: now,
        }
      : scenario,
  );

  return {
    ...bundle,
    scenarios,
    updatedAt: now,
    overall: assessQualification(scenarios),
  };
}

export function parseQualificationBundle(
  text: string,
): PartyQualificationBundle {
  const value = JSON.parse(text) as Partial<PartyQualificationBundle>;

  if (
    value.schema !== "jukebot.party.qualification.v1" ||
    typeof value.sessionId !== "string" ||
    !Array.isArray(value.scenarios)
  ) {
    throw new Error("Unsupported JukeBot Party qualification bundle");
  }

  const known = new Set(QUALIFICATION_SCENARIOS.map((scenario) => scenario.id));

  const scenarios = value.scenarios
    .filter(
      (scenario): scenario is QualificationScenarioResult =>
        Boolean(
          scenario &&
            typeof scenario.id === "string" &&
            known.has(scenario.id as QualificationScenarioId) &&
            ["NOT_RUN", "PASS", "FAIL", "BLOCKED"].includes(
              String(scenario.status),
            ),
        ),
    )
    .map((scenario) => ({
      ...scenario,
      notes: String(scenario.notes ?? ""),
    }));

  if (scenarios.length !== QUALIFICATION_SCENARIOS.length) {
    throw new Error("Qualification bundle is missing required scenarios");
  }

  return {
    schema: "jukebot.party.qualification.v1",
    sessionId: value.sessionId,
    createdAt: String(value.createdAt ?? ""),
    updatedAt: String(value.updatedAt ?? ""),
    scenarios,
    overall: assessQualification(scenarios),
  };
}
