import { spawn } from "node:child_process";
import { once } from "node:events";
import readline from "node:readline";

const child = spawn(process.execPath, ["relay/server.mjs"], {
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: "0",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

const stderr = [];
child.stderr.on("data", (chunk) => stderr.push(String(chunk)));

const lines = readline.createInterface({
  input: child.stdout,
  crlfDelay: Infinity,
});

let ready;

const timeout = setTimeout(() => {
  child.kill("SIGKILL");
}, 10_000);

try {
  for await (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    if (event?.event === "relay.ready") {
      ready = event;
      break;
    }
  }

  if (!ready?.address?.port) {
    throw new Error(
      `Relay did not report a listening port. ${stderr.join("")}`,
    );
  }

  const base = `http://127.0.0.1:${ready.address.port}`;

  const health = await fetch(`${base}/healthz`);
  if (!health.ok) {
    throw new Error(`Health endpoint returned ${health.status}`);
  }
  const healthBody = await health.json();
  if (healthBody?.ok !== true) {
    throw new Error("Health endpoint did not report ok=true");
  }

  const status = await fetch(`${base}/status`);
  if (!status.ok) {
    throw new Error(`Status endpoint returned ${status.status}`);
  }
  const statusBody = await status.json();
  if (
    statusBody?.service !== "jukebot-ws-relay" ||
    statusBody?.version !== 1 ||
    typeof statusBody?.subscriptions !== "number"
  ) {
    throw new Error("Status endpoint returned an invalid service manifest");
  }

  child.kill("SIGTERM");
  const [code, signal] = await once(child, "exit");

  if (code !== 0 && signal !== "SIGTERM") {
    throw new Error(
      `Relay exited unexpectedly: code=${code} signal=${signal}\n${stderr.join("")}`,
    );
  }

  console.log(
    JSON.stringify({
      result: "PASS",
      relayPort: ready.address.port,
      health: healthBody,
      status: statusBody,
    }),
  );
} finally {
  clearTimeout(timeout);
  if (!child.killed && child.exitCode === null) child.kill("SIGKILL");
  lines.close();
}
