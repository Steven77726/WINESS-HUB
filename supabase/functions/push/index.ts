import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHash } from "node:crypto";

const allowedOrigins = new Set([
  "https://steven77726.github.io",
  "http://127.0.0.1:4177",
  "http://localhost:4177",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://steven77726.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function adminClient() {
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(Deno.env.get("SUPABASE_URL")!, secretKey!, { auth: { persistSession: false } });
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Méthode refusée" }), { status: 405, headers });

  try {
    const payload = await request.json();
    const supabase = adminClient();

    if (payload.action === "subscribe") {
      const { user_id, subscription } = payload;
      if (!user_id || !subscription?.endpoint) return new Response(JSON.stringify({ error: "Abonnement invalide" }), { status: 400, headers });
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        subscription,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    if (payload.action === "notify") {
      const { user_id, title, body, url, event_id } = payload;
      if (!user_id || !title || !body) return new Response(JSON.stringify({ error: "Notification invalide" }), { status: 400, headers });

      const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
      const eventKey = event_id || createHash("sha256").update(`${user_id}:${title}:${body}:${bucket}`).digest("hex");
      const { error: eventError } = await supabase.from("push_notification_events").insert({ event_key: eventKey, user_id, title });
      if (eventError?.code === "23505") return new Response(JSON.stringify({ ok: true, duplicate: true, sent: 0 }), { headers });
      if (eventError) throw eventError;

      webpush.setVapidDetails(
        Deno.env.get("VAPID_SUBJECT") || "mailto:contact@winess.fr",
        Deno.env.get("VAPID_PUBLIC_KEY")!,
        Deno.env.get("VAPID_PRIVATE_KEY")!,
      );

      const { data, error } = await supabase.from("push_subscriptions").select("id,subscription").eq("user_id", user_id);
      if (error) throw error;
      let sent = 0;
      let failed = 0;
      await Promise.all((data || []).map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url, event_id: eventKey }));
          sent += 1;
        } catch (pushError: unknown) {
          failed += 1;
          const statusCode = typeof pushError === "object" && pushError !== null && "statusCode" in pushError ? Number(pushError.statusCode) : 0;
          if ([404, 410].includes(statusCode)) await supabase.from("push_subscriptions").delete().eq("id", row.id);
        }
      }));
      return new Response(JSON.stringify({ ok: true, duplicate: false, sent, failed }), { headers });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), { status: 400, headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erreur serveur" }), { status: 500, headers });
  }
});
