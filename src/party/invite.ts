import type {
  PartyInvite,
  PartyJoinInfo,
  PartyTransportProfile,
} from "./types";
import { normalizeTransportProfile } from "./transport";

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

function encodeJson(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeJson<T>(value: string): T {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function hasCustomTransport(profile?: PartyTransportProfile): boolean {
  return Boolean(
    profile?.relayUrls?.length ||
    profile?.turn?.length ||
    (profile?.relayRedundancy && profile.relayRedundancy !== 5),
  );
}

export function createPartyInvite(
  hostPeerId: string,
  transport?: PartyTransportProfile,
): PartyInvite {
  return {
    protocol: PARTY_PROTOCOL,
    roomId: randomBase64Url(12),
    hostPeerId,
    password: randomBase64Url(24),
    transport: transport ? normalizeTransportProfile(transport) : undefined,
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

  if (hasCustomTransport(invite.transport)) {
    fragment.set("net", encodeJson(invite.transport));
  }

  url.hash = fragment.toString();

  return url.toString();
}

export function parsePartyInviteUrl(input: string): PartyJoinInfo | null {
  const url = new URL(input);
  const roomId = url.searchParams.get("party")?.trim();
  const hostPeerId = url.searchParams.get("host")?.trim();

  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const password = fragment.get("key")?.trim();
  const encodedTransport = fragment.get("net");

  if (!roomId || !hostPeerId || !password) return null;

  let transport: PartyTransportProfile | undefined;
  if (encodedTransport) {
    try {
      transport = normalizeTransportProfile(
        decodeJson<PartyTransportProfile>(encodedTransport),
      );
    } catch {
      return null;
    }
  }

  return {
    roomId,
    hostPeerId,
    password,
    transport,
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
