import { canPerform } from "./authority";
import { roomStateHash } from "./hash";
import { initialRoomState, reduceRoom } from "./reducer";
import type { Receipt, RoomState } from "./types";

export type ReplayStatus = "EXACT" | "MIXED_LEGACY" | "PARTIAL" | "MISMATCH" | "EMPTY";

export interface ReplayReport {
  status: ReplayStatus;
  receipts: number;
  checkedV2: number;
  legacyReceipts: number;
  finalHash: string;
  mismatchAt?: number;
  reason?: string;
  state: RoomState;
}

export function validateReplay(
  receipts: Receipt[],
  roomId = "local-room",
): ReplayReport {
  let state = initialRoomState(roomId);
  let checkedV2 = 0;
  let legacyReceipts = 0;
  let sawAccepted = false;

  if (!receipts.length) {
    return {
      status: "EMPTY",
      receipts: 0,
      checkedV2: 0,
      legacyReceipts: 0,
      finalHash: roomStateHash(state),
      state,
    };
  }

  for (let index = 0; index < receipts.length; index += 1) {
    const receipt = receipts[index]!;
    const authorityAllows = canPerform(receipt.actor.role, receipt.action);

    if (authorityAllows !== receipt.accepted) {
      return {
        status: "MISMATCH",
        receipts: receipts.length,
        checkedV2,
        legacyReceipts,
        finalHash: roomStateHash(state),
        mismatchAt: index,
        reason: "Receipt acceptance does not match current authority policy",
        state,
      };
    }

    if (receipt.accepted) {
      state = reduceRoom(state, receipt.action);
      sawAccepted = true;
      if (state.seq !== receipt.seq) {
        return {
          status: "PARTIAL",
          receipts: receipts.length,
          checkedV2,
          legacyReceipts,
          finalHash: roomStateHash(state),
          mismatchAt: index,
          reason: `Ledger prefix is incomplete: replay seq ${state.seq}, receipt seq ${receipt.seq}`,
          state,
        };
      }
    } else if (state.seq !== receipt.seq) {
      return {
        status: "PARTIAL",
        receipts: receipts.length,
        checkedV2,
        legacyReceipts,
        finalHash: roomStateHash(state),
        mismatchAt: index,
        reason: `Rejected action references unavailable seq ${receipt.seq}`,
        state,
      };
    }

    if (receipt.stateHashVersion === "room-v2") {
      checkedV2 += 1;
      const actual = roomStateHash(state);
      if (actual !== receipt.stateHash) {
        return {
          status: "MISMATCH",
          receipts: receipts.length,
          checkedV2,
          legacyReceipts,
          finalHash: actual,
          mismatchAt: index,
          reason: `State hash mismatch: expected ${receipt.stateHash}, got ${actual}`,
          state,
        };
      }
    } else {
      legacyReceipts += 1;
    }
  }

  const finalHash = roomStateHash(state);

  if (!sawAccepted && legacyReceipts === receipts.length) {
    return {
      status: "MIXED_LEGACY",
      receipts: receipts.length,
      checkedV2,
      legacyReceipts,
      finalHash,
      reason: "Ledger predates portable room-v2 hashing",
      state,
    };
  }

  return {
    status: legacyReceipts ? "MIXED_LEGACY" : "EXACT",
    receipts: receipts.length,
    checkedV2,
    legacyReceipts,
    finalHash,
    reason: legacyReceipts
      ? "Legacy receipts were replayed by action/sequence; room-v2 receipts were hash-verified"
      : undefined,
    state,
  };
}
