import express from "express";
import cors from "cors";
import { createHash } from "node:crypto";

const USER_ID_PATTERN = /^[a-z0-9_-]{2,64}$/i;

export function createApp({ store, webpushClient, corsOrigins }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Origine refusée"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
  }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", async (_request, response) => {
    try {
      await store.health();
      response.json({ ok: true, service: "winess-hub-push" });
    } catch {
      response.status(503).json({ ok: false, error: "Supabase indisponible" });
    }
  });

  app.post("/subscribe", async (request, response, next) => {
    try {
      const { user_id: userId, subscription } = request.body || {};
      if (!validUserId(userId) || !validSubscription(subscription)) return response.status(400).json({ error: "Abonnement invalide" });
      await store.upsertSubscription(userId, subscription);
      response.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post("/notify", async (request, response, next) => {
    try {
      const { user_id: userId, title, body, url, event_id: eventId } = request.body || {};
      if (!validUserId(userId) || !validText(title, 120) || !validText(body, 500)) return response.status(400).json({ error: "Notification invalide" });

      const eventKey = buildEventKey({ eventId, userId, title, body });
      const isNew = await store.recordEvent(eventKey, userId, title);
      if (!isNew) return response.json({ ok: true, duplicate: true, sent: 0, failed: 0 });

      const subscriptions = await store.getSubscriptions(userId);
      const results = await Promise.allSettled(subscriptions.map(async (row) => {
        try {
          await webpushClient.sendNotification(row.subscription, JSON.stringify({
            title,
            body,
            url: validUrl(url) ? url : "./index.html#view-accueil",
            event_id: eventKey
          }));
        } catch (error) {
          if ([404, 410].includes(Number(error?.statusCode))) await store.deleteSubscription(row.id);
          throw error;
        }
      }));

      response.json({
        ok: true,
        duplicate: false,
        sent: results.filter((item) => item.status === "fulfilled").length,
        failed: results.filter((item) => item.status === "rejected").length
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, response) => response.status(404).json({ error: "Route introuvable" }));
  app.use((error, _request, response, _next) => {
    console.error("Push backend error", error?.message || error);
    response.status(error?.message === "Origine refusée" ? 403 : 500).json({ error: "Erreur serveur" });
  });
  return app;
}

function validUserId(value) {
  return typeof value === "string" && USER_ID_PATTERN.test(value);
}

function validSubscription(subscription) {
  return Boolean(subscription && typeof subscription.endpoint === "string" && subscription.endpoint.startsWith("https://") && subscription.keys?.p256dh && subscription.keys?.auth);
}

function validText(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function validUrl(value) {
  return typeof value === "string" && (value.startsWith("./") || value.startsWith("#") || value.startsWith("https://steven77726.github.io/WINESS-HUB/"));
}

function buildEventKey({ eventId, userId, title, body }) {
  if (typeof eventId === "string" && eventId.length > 0 && eventId.length <= 200) return eventId;
  const fiveMinuteBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return createHash("sha256").update(`${userId}:${title}:${body}:${fiveMinuteBucket}`).digest("hex");
}
