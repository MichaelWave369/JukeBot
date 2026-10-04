import { describe, expect, it } from "vitest";
import {
  assessQualification,
  captureQualificationEvidence,
  createQualificationSession,
  emptyQualificationObservations,
  parseQualificationBundle,
  safeTransportEvidence,
  scenarioPassEvidenceSatisfied,
  updateQualificationScenario,
} from "../src/party/qualification";
import type {
  QualificationEvidenceSnapshot,
  QualificationScenarioId,
} from "../src/party/qualification";
import type { PartyTransportProfile } from "../src/party/types";

function evidence(
  id: QualificationScenarioId,
): QualificationEvidenceSnapshot {
  const observations = emptyQualificationObservations();
  const base: QualificationEvidenceSnapshot = {
    capturedAt: "fixed",
    transport: {
      strategy: "nostr",
      relayCount: 0,
      defaultRelayRedundancy: 5,
      turnConfigured: false,
      turnServerCount: 0,
    },
    environment: {
      secureContext: true,
      webRtcAvailable: true,
      webCryptoAvailable: true,
      webSocketAvailable: true,
      online: true,
    },
    observations,
  };

  switch (id) {
    case "lan_nostr":
    case "cellular_nostr":
      base.observations.peerJoinCount = 1;
      break;
    case "controlled_relay":
      base.transport.strategy = "ws-relay";
      base.transport.relayCount = 1;
      base.observations.peerJoinCount = 1;
      break;
    case "turn_fallback":
      base.transport.turnConfigured = true;
      base.transport.turnServerCount = 1;
      base.observations.peerJoinCount = 1;
      break;
    case "reconnect_idempotency":
      base.observations.peerJoinCount = 2;
      base.observations.peerLeaveCount = 1;
      base.observations.duplicateRequestCount = 1;
      break;
    case "multi_guest":
      base.observations.maxConcurrentPeers = 2;
      break;
    case "native_ledger_link":
      base.observations.nativeEffectLinkedCount = 1;
      break;
    case "suno_hosted":
      base.observations.sunoAcceptedCount = 1;
      break;
    case "host_restart_rejoin":
      base.observations.roomStartCount = 2;
      base.observations.roomStopCount = 1;
      base.observations.peerJoinCount = 2;
      break;
  }

  return base;
}

describe("Party physical qualification", () => {
  it("starts PARTIAL with every physical scenario NOT_RUN", () => {
    const session = createQualificationSession("t0", "qual-test");

    expect(session.overall).toBe("PARTIAL");
    expect(session.scenarios).toHaveLength(9);
    expect(session.scenarios.every((scenario) => scenario.status === "NOT_RUN"))
      .toBe(true);
  });

  it("becomes FIELD_QUALIFIED only when every required scenario passes with matching evidence", () => {
    let session = createQualificationSession("t0", "qual-test");

    for (const scenario of session.scenarios) {
      session = updateQualificationScenario(
        session,
        scenario.id,
        {
          status: "PASS",
          notes: "Physical run observed",
          evidence: evidence(scenario.id),
        },
        "t1",
      );
    }

    expect(session.overall).toBe("FIELD_QUALIFIED");
    expect(assessQualification(session.scenarios)).toBe("FIELD_QUALIFIED");
  });

  it("fails qualification when a PASS contradicts its captured machine evidence", () => {
    let session = createQualificationSession("t0", "qual-test");

    session = updateQualificationScenario(
      session,
      "controlled_relay",
      {
        status: "PASS",
        notes: "claimed controlled run",
        evidence: evidence("lan_nostr"),
      },
      "t1",
    );

    expect(session.overall).toBe("FAIL");
  });

  it("keeps BLOCKED and NOT_RUN cases PARTIAL rather than fabricating readiness", () => {
    let session = createQualificationSession("t0", "qual-test");

    session = updateQualificationScenario(
      session,
      "turn_fallback",
      {
        status: "BLOCKED",
        notes: "No TURN provider available for this run",
        evidence: evidence("lan_nostr"),
      },
      "t1",
    );

    expect(session.overall).toBe("PARTIAL");
  });

  it("requires real reconnect, multi-peer, ledger-link and Suno counters", () => {
    expect(
      scenarioPassEvidenceSatisfied(
        "reconnect_idempotency",
        evidence("reconnect_idempotency"),
      ),
    ).toBe(true);
    expect(
      scenarioPassEvidenceSatisfied("multi_guest", evidence("multi_guest")),
    ).toBe(true);
    expect(
      scenarioPassEvidenceSatisfied(
        "native_ledger_link",
        evidence("native_ledger_link"),
      ),
    ).toBe(true);
    expect(
      scenarioPassEvidenceSatisfied("suno_hosted", evidence("suno_hosted")),
    ).toBe(true);

    const empty = evidence("lan_nostr");
    expect(
      scenarioPassEvidenceSatisfied("reconnect_idempotency", empty),
    ).toBe(false);
    expect(scenarioPassEvidenceSatisfied("multi_guest", empty)).toBe(false);
  });

  it("reduces transport evidence to safe counts and never exports credentials or relay URLs", () => {
    const profile: PartyTransportProfile = {
      version: 1,
      strategy: "ws-relay",
      relayUrls: ["wss://private-relay.example/secret-path"],
      turn: [
        {
          urls: ["turns:turn.example:5349"],
          username: "private-user",
          credential: "private-password",
        },
      ],
    };

    const safe = safeTransportEvidence(profile);
    const captured = captureQualificationEvidence(
      profile,
      emptyQualificationObservations(),
      "fixed",
    );
    const serialized = JSON.stringify(captured);

    expect(safe).toEqual({
      strategy: "ws-relay",
      relayCount: 1,
      defaultRelayRedundancy: undefined,
      turnConfigured: true,
      turnServerCount: 1,
    });
    expect(serialized).not.toContain("private-relay");
    expect(serialized).not.toContain("turn.example");
    expect(serialized).not.toContain("private-user");
    expect(serialized).not.toContain("private-password");
  });

  it("recomputes imported qualification status instead of trusting a claimed overall value", () => {
    const session = createQualificationSession("t0", "qual-test");
    const tampered = JSON.stringify({
      ...session,
      overall: "FIELD_QUALIFIED",
    });

    const parsed = parseQualificationBundle(tampered);

    expect(parsed.overall).toBe("PARTIAL");
  });
});
