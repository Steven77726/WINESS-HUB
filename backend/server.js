import "dotenv/config";
import express from "express";
import cors from "cors";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

const app = express();
const port = process.env.PORT || 8787;
app.use(cors({ origin: (process.env.CORS_ORIGIN || "http://127.0.0.1:4177").split(",") }));
app.use(express.json({ limit: "512kb" }));

webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

app.get("/health", (_request, response) => response.json({ ok: true }));

app.post("/subscribe", async (request, response) => {
  const { user_id, subscription } = request.body || {};
  if (!user_id || !subscription?.endpoint) return response.status(400).json({ error: "Abonnement invalide" });
  const now = new Date().toISOString();
  const { error } = await supabase.from("push_subscriptions").upsert({ user_id, endpoint: subscription.endpoint, keys: subscription.keys, subscription, updated_at: now }, { onConflict: "endpoint" });
  if (error) return response.status(500).json({ error: error.message });
  response.json({ ok: true });
});

app.post("/notify", async (request, response) => {
  const { user_id, title, body, url, event_id } = request.body || {};
  if (!user_id || !title || !body) return response.status(400).json({ error: "Notification invalide" });

  const fiveMinuteBucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const eventKey = event_id || createHash("sha256").update(`${user_id}:${title}:${body}:${fiveMinuteBucket}`).digest("hex");
  const { error: dedupeError } = await supabase.from("push_notification_events").insert({ event_key: eventKey, user_id, title });
  if (dedupeError?.code === "23505") return response.json({ ok: true, duplicate: true, sent: 0 });
  if (dedupeError) return response.status(500).json({ error: dedupeError.message });

  const { data, error } = await supabase.from("push_subscriptions").select("id, subscription").eq("user_id", user_id);
  if (error) return response.status(500).json({ error: error.message });
  const results = await Promise.allSettled((data || []).map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url, event_id: eventKey }));
    } catch (pushError) {
      if ([404, 410].includes(pushError.statusCode)) await supabase.from("push_subscriptions").delete().eq("id", row.id);
      throw pushError;
    }
  }));
  response.json({ ok: true, duplicate: false, sent: results.filter((item) => item.status === "fulfilled").length, failed: results.filter((item) => item.status === "rejected").length });
});

app.listen(port, () => console.log(`Winess Hub Push :${port}`));
