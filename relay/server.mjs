import { createServer } from "node:http";
import { createWsRelayServer } from "@trystero-p2p/ws-relay/server";

function intEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

const host = process.env.HOST?.trim() || "0.0.0.0";
const port = intEnv("PORT", 8080, 0, 65535);
const maxTopicLength = intEnv("MAX_TOPIC_LENGTH", 256, 32, 4096);
const maxSubscriptionsPerSocket = intEnv(
  "MAX_SUBSCRIPTIONS_PER_SOCKET",
  128,
  1,
  4096,
);
const maxSubscriptions = intEnv(
  "MAX_SUBSCRIPTIONS",
  10_000,
  1,
  1_000_000,
);
const startedAt = Date.now();

let relay;

const httpServer = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://relay.local");

  if (url.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/status") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        service: "jukebot-ws-relay",
        version: 1,
        uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        subscriptions: relay?.getSubscriberCount() ?? 0,
        limits: {
          maxTopicLength,
          maxSubscriptionsPerSocket,
          maxSubscriptions,
        },
      }),
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

relay = createWsRelayServer({
  server: httpServer,
  maxTopicLength,
  maxSubscriptionsPerSocket,
  maxSubscriptions,
  onError: (error) => {
    console.error("[JukeBot relay]", error.message);
  },
});

await new Promise((resolve, reject) => {
  httpServer.once("error", reject);
  httpServer.listen(port, host, resolve);
});

await relay.ready;

const address = httpServer.address();
console.log(
  JSON.stringify({
    event: "relay.ready",
    address:
      typeof address === "object" && address
        ? { host: address.address, port: address.port }
        : address,
    limits: {
      maxTopicLength,
      maxSubscriptionsPerSocket,
      maxSubscriptions,
    },
  }),
);

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(JSON.stringify({ event: "relay.shutdown", signal }));

  await relay.close().catch((error) => {
    console.error("[JukeBot relay] close error", error);
  });

  await new Promise((resolve) => {
    httpServer.close(() => resolve());
  });

  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
