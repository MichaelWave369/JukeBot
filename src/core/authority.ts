import type { ActorRole, JukeAction } from "./types";

const allActions = new Set<JukeAction["type"]>([
  "ADD_TRACK",
  "REMOVE_TRACK",
  "UPDATE_TRACK_METADATA",
  "ENQUEUE_TRACK",
  "REMOVE_FROM_QUEUE",
  "PLAY",
  "PAUSE",
  "STOP",
  "SKIP",
  "SET_VOLUME",
  "SET_REPEAT",
  "CLEAR_QUEUE",
]);

const guestActions = new Set<JukeAction["type"]>([
  "ADD_TRACK",
  "ENQUEUE_TRACK",
]);

const agentActions = new Set<JukeAction["type"]>([
  "ADD_TRACK",
  "ENQUEUE_TRACK",
  "REMOVE_FROM_QUEUE",
  "PLAY",
  "PAUSE",
  "STOP",
  "SKIP",
  "SET_REPEAT",
]);

export function canPerform(role: ActorRole, action: JukeAction): boolean {
  if (role === "operator" || role === "dj") return allActions.has(action.type);
  if (role === "guest") return guestActions.has(action.type);
  return agentActions.has(action.type);
}
