import type { PartyInvite, PartyJoinInfo } from "./types";

const PARTY_PROTOCOL = "jukebot.party.v1";

function randomBase64Url(bytes: number): string {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);

  let binary = "";
  for (const value of data) binary += String.fromCharCode(value);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createPartyInvite(hostPeerId: string): PartyInvite {
  return {
    protocol: PARTY_PROTOCOL,
    roomId: randomBase64Url(12),
    hostPeerId,
    password: randomBase64Url(24),
  };
}

export function buildPartyInviteUrl(
  invite: PartyInvite,
  baseUrl: string,
): string {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";

  url.searchParams.set("party", invite.roomId);
  url.searchParams.set("host", invite.hostPeerId);

  const fragment = new URLSearchParams();
  fragment.set("key", invite.password);
  url.hash = fragment.toString();

  return url.toString();
}

export function parsePartyInviteUrl(input: string): PartyJoinInfo | null {
  const url = new URL(input);
  const roomId = url.searchParams.get("party")?.trim();
  const hostPeerId = url.searchParams.get("host")?.trim();

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const password = fragment.get("key")?.trim();

  if (!roomId || !hostPeerId || !password) return null;

  return {
    roomId,
    hostPeerId,
    password,
  };
}

export function currentPartyInvite(): PartyJoinInfo | null {
  return parsePartyInviteUrl(window.location.href);
}

export function clearPartyInviteFromLocation(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("party");
  url.searchParams.delete("host");
  url.hash = "";
  history.replaceState(null, "", url.toString());
}
