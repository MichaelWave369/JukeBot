import { useEffect, useMemo, useState } from "react";
import {
  QUALIFICATION_SCENARIOS,
  assessQualification,
  captureQualificationEvidence,
  createQualificationSession,
  parseQualificationBundle,
  scenarioPassEvidenceSatisfied,
  updateQualificationScenario,
} from "../party/qualification";
import type {
  PartyQualificationBundle,
  QualificationObservations,
  QualificationScenarioId,
  QualificationScenarioStatus,
} from "../party/qualification";
import type { PartyTransportProfile } from "../party/types";

const STORAGE_KEY = "jukebot.party.qualification.v1";

interface QualificationPanelProps {
  transportProfile?: PartyTransportProfile;
  observations: QualificationObservations;
  onNotice: (message: string) => void;
}

function loadSession(): PartyQualificationBundle {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return createQualificationSession();

  try {
    return parseQualificationBundle(stored);
  } catch {
    return createQualificationSession();
  }
}

function saveBlob(bundle: PartyQualificationBundle) {
  const safe = {
    ...bundle,
    overall: assessQualification(bundle.scenarios),
  };

  const blob = new Blob([JSON.stringify(safe, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `jukebot-party-qualification-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function shortStatus(status: QualificationScenarioStatus): string {
  return status.replace("_", " ");
}

export function QualificationPanel({
  transportProfile,
  observations,
  onNotice,
}: QualificationPanelProps) {
  const [bundle, setBundle] = useState<PartyQualificationBundle>(() =>
    loadSession(),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
  }, [bundle]);

  const passed = useMemo(
    () => bundle.scenarios.filter((scenario) => scenario.status === "PASS").length,
    [bundle.scenarios],
  );

  function updateNotes(id: QualificationScenarioId, notes: string) {
    setBundle((current) =>
      updateQualificationScenario(current, id, { notes }),
    );
  }

  function setStatus(
    id: QualificationScenarioId,
    status: QualificationScenarioStatus,
  ) {
    setBundle((current) => {
      const existing = current.scenarios.find((scenario) => scenario.id === id);
      const evidence =
        status === "NOT_RUN"
          ? undefined
          : captureQualificationEvidence(transportProfile, observations);

      if (
        status === "PASS" &&
        (!existing?.notes.trim() ||
          !scenarioPassEvidenceSatisfied(id, evidence))
      ) {
        onNotice(
          "PASS requires a field note plus the machine evidence expected for that scenario",
        );
        return current;
      }

      return updateQualificationScenario(current, id, {
        status,
        evidence,
      });
    });
  }

  function newSession() {
    const fresh = createQualificationSession();
    setBundle(fresh);
    onNotice("Started a new Party physical qualification session");
  }

  function exportEvidence() {
    saveBlob(bundle);
    onNotice(`Exported qualification evidence · ${bundle.overall}`);
  }

  function clearStored() {
    const fresh = createQualificationSession();
    localStorage.removeItem(STORAGE_KEY);
    setBundle(fresh);
    onNotice("Cleared local qualification evidence and started fresh");
  }

  return (
    <section className="qualification-panel">
      <div className="panel-head qualification-head">
        <div>
          <p className="eyebrow">RUNG 3C3 / PHYSICAL NETWORK QUALIFICATION</p>
          <h3>FIELD EVIDENCE</h3>
        </div>
        <div className="qualification-summary">
          <span className={`qualification-overall ${bundle.overall.toLowerCase()}`}>
            {bundle.overall.replace("_", " ")}
          </span>
          <span>{passed}/{QUALIFICATION_SCENARIOS.length} PASS</span>
        </div>
      </div>

      <p className="source-note">
        This panel records physical test evidence only. It stores no room secret,
        TURN credential, peer ID, media URL, or local IP address.
      </p>

      <div className="qualification-observations">
        <span>STARTS {observations.roomStartCount}</span>
        <span>STOPS {observations.roomStopCount}</span>
        <span>JOINS {observations.peerJoinCount}</span>
        <span>LEAVES {observations.peerLeaveCount}</span>
        <span>MAX PEERS {observations.maxConcurrentPeers}</span>
        <span>DUP RETRIES {observations.duplicateRequestCount}</span>
        <span>NATIVE LINKS {observations.nativeEffectLinkedCount}</span>
        <span>SUNO ACCEPTS {observations.sunoAcceptedCount}</span>
        <span>JOIN ERRORS {observations.joinErrorCount}</span>
      </div>

      <div className="qualification-actions">
        <button onClick={newSession}>NEW SESSION</button>
        <button onClick={exportEvidence}>EXPORT EVIDENCE</button>
        <button className="danger" onClick={clearStored}>CLEAR</button>
      </div>

      <div className="qualification-grid">
        {QUALIFICATION_SCENARIOS.map((definition) => {
          const result = bundle.scenarios.find(
            (scenario) => scenario.id === definition.id,
          )!;

          const liveEvidence = captureQualificationEvidence(
            transportProfile,
            observations,
          );
          const canPass =
            Boolean(result.notes.trim()) &&
            scenarioPassEvidenceSatisfied(definition.id, liveEvidence);

          return (
            <article
              className={`qualification-card status-${result.status.toLowerCase()}`}
              key={definition.id}
            >
              <div className="qualification-card-head">
                <div>
                  <strong>{definition.title}</strong>
                  <small>{shortStatus(result.status)}</small>
                </div>
                <code>{definition.id}</code>
              </div>

              <p>{definition.instruction}</p>
              <small className="qualification-proof">
                REQUIRED: {definition.requiredEvidence}
              </small>

              <textarea
                rows={3}
                value={result.notes}
                onChange={(event) =>
                  updateNotes(definition.id, event.target.value)
                }
                placeholder="Physical setup + what you observed"
              />

              <div className="qualification-buttons">
                <button
                  disabled={!canPass}
                  title={
                    canPass
                      ? "Record PASS with current safe evidence"
                      : "Add a field note and satisfy this scenario's machine evidence first"
                  }
                  onClick={() => setStatus(definition.id, "PASS")}
                >
                  PASS
                </button>
                <button
                  className="danger"
                  onClick={() => setStatus(definition.id, "FAIL")}
                >
                  FAIL
                </button>
                <button onClick={() => setStatus(definition.id, "BLOCKED")}>
                  BLOCKED
                </button>
                <button onClick={() => setStatus(definition.id, "NOT_RUN")}>
                  RESET
                </button>
              </div>

              {result.evidence ? (
                <div className="qualification-evidence">
                  <span>
                    {result.evidence.transport.strategy.toUpperCase()}
                    {result.evidence.transport.turnConfigured ? " + TURN" : ""}
                  </span>
                  <span>
                    peers max {result.evidence.observations.maxConcurrentPeers}
                  </span>
                  <span>
                    joins {result.evidence.observations.peerJoinCount}
                  </span>
                  <span>
                    {new Date(result.evidence.capturedAt).toLocaleString()}
                  </span>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
