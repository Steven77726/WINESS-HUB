import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../app.js";

const subscription = {
  endpoint: "https://push.example.test/subscription-1",
  keys: { p256dh: "public-key", auth: "auth-key" }
};

function dependencies(overrides = {}) {
  return {
    corsOrigins: ["https://steven77726.github.io"],
    store: {
      health: async () => {},
      upsertSubscription: async () => {},
      recordEvent: async () => true,
      getSubscriptions: async () => [],
      deleteSubscription: async () => {},
      ...overrides.store
    },
    webpushClient: { sendNotification: async () => {}, ...overrides.webpushClient }
  };
}

async function withServer(t, deps) {
  const server = createApp(deps).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  return `http://127.0.0.1:${server.address().port}`;
}

test("GET /health confirme Supabase", async (t) => {
  const baseUrl = await withServer(t, dependencies());
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "winess-hub-push" });
});

test("POST /subscribe enregistre un endpoint unique", async (t) => {
  let saved;
  const deps = dependencies({ store: { upsertSubscription: async (userId, value) => { saved = { userId, value }; } } });
  const baseUrl = await withServer(t, deps);
  const response = await fetch(`${baseUrl}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://steven77726.github.io" },
    body: JSON.stringify({ user_id: "theo", subscription })
  });
  assert.equal(response.status, 200);
  assert.deepEqual(saved, { userId: "theo", value: subscription });
});

test("POST /notify bloque un event_id déjà envoyé", async (t) => {
  let subscriptionReads = 0;
  const deps = dependencies({ store: { recordEvent: async () => false, getSubscriptions: async () => { subscriptionReads += 1; return []; } } });
  const baseUrl = await withServer(t, deps);
  const response = await fetch(`${baseUrl}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "theo", title: "Nouvelle tâche", body: "Préparer Azran", event_id: "task:azran:assigned" })
  });
  assert.deepEqual(await response.json(), { ok: true, duplicate: true, sent: 0, failed: 0 });
  assert.equal(subscriptionReads, 0);
});

test("POST /notify envoie et retire les abonnements expirés", async (t) => {
  const deleted = [];
  const sent = [];
  const deps = dependencies({
    store: {
      getSubscriptions: async () => [{ id: "valid", subscription }, { id: "expired", subscription: { ...subscription, endpoint: "https://push.example.test/expired" } }],
      deleteSubscription: async (id) => deleted.push(id)
    },
    webpushClient: {
      sendNotification: async (value, payload) => {
        sent.push({ value, payload: JSON.parse(payload) });
        if (value.endpoint.endsWith("expired")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      }
    }
  });
  const baseUrl = await withServer(t, deps);
  const response = await fetch(`${baseUrl}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "theo", title: "Nouvelle tâche", body: "Préparer Azran", url: "./index.html#task-azran", event_id: "task:azran:assigned" })
  });
  assert.deepEqual(await response.json(), { ok: true, duplicate: false, sent: 1, failed: 1 });
  assert.equal(sent.length, 2);
  assert.deepEqual(deleted, ["expired"]);
});

test("CORS refuse une origine inconnue", async (t) => {
  const baseUrl = await withServer(t, dependencies());
  const response = await fetch(`${baseUrl}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://example.org" },
    body: JSON.stringify({ user_id: "theo", subscription })
  });
  assert.equal(response.status, 403);
});
