import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { JukeRuntime } from "./core/runtime";
import type { Actor, JukeAction } from "./core/types";
import { JukePersistence } from "./persistence/indexedDb";
import "./styles.css";

declare global {
  interface Window {
    JukeBot: {
      observe: () => ReturnType<JukeRuntime["observe"]>;
      ledger: () => ReturnType<JukeRuntime["ledger"]>;
      submit: (action: JukeAction, actor?: Actor) => ReturnType<JukeRuntime["submit"]>;
      persistence: "indexeddb" | "ephemeral";
    };
  }
}

const operator: Actor = { id: "operator.local", role: "operator", label: "Operator" };

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function bootstrap() {
  let persistence: JukePersistence | null = null;
  let runtime: JukeRuntime;

  try {
    persistence = new JukePersistence();
    const restored = await persistence.restore();
    runtime = new JukeRuntime("local-room", undefined, restored.state, restored.receipts);
  } catch {
    persistence = null;
    runtime = new JukeRuntime();
  }

  window.JukeBot = {
    observe: () => runtime.observe(),
    ledger: () => runtime.ledger(),
    submit: (action, actor = operator) =>
      runtime.submit({ actionId: id("act"), actor, action }),
    persistence: persistence ? "indexeddb" : "ephemeral",
  };

  const root = document.getElementById("root");
  if (!root) throw new Error("Missing #root");

  createRoot(root).render(
    <StrictMode>
      <App runtime={runtime} persistence={persistence} />
    </StrictMode>,
  );
}

void bootstrap();
