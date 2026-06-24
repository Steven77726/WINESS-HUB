import webpush from "npm:web-push@3.6.7";
import { adminClient, allowedRequest, corsHeaders, eventKeyFor, json, safeTaskUrl, validText, validUserId } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Méthode refusée" }, 405);
  if (!allowedRequest(request)) return json(request, { error: "Accès refusé" }, 401);

  try {
    const { user_id: userId, title, body, url, event_id: eventId } = await request.json();
    if (!validUserId(userId) || !validText(title, 120) || !validText(body, 500)) return json(request, { error: "Notification invalide" }, 400);

    const supabase = adminClient();
    const eventKey = await eventKeyFor(eventId, userId, title, body);
    const { error: eventError } = await supabase.from("push_notification_events").insert({ event_key: eventKey, user_id: userId, title });
    if (eventError?.code === "23505") return json(request, { ok: true, duplicate: true, sent: 0, failed: 0 });
    if (eventError) throw eventError;

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) throw new Error("Secrets VAPID absents");
    webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") || "mailto:contact@winess.fr", vapidPublicKey, vapidPrivateKey);

    const { data, error } = await supabase.from("push_subscriptions").select("id,subscription").eq("user_id", userId);
    if (error) throw error;
    const results = await Promise.allSettled((data || []).map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url: safeTaskUrl(url), event_id: eventKey }));
      } catch (pushError: unknown) {
        const statusCode = typeof pushError === "object" && pushError !== null && "statusCode" in pushError ? Number(pushError.statusCode) : 0;
        if ([404, 410].includes(statusCode)) await supabase.from("push_subscriptions").delete().eq("id", row.id);
        throw pushError;
      }
    }));

    const sent = results.filter((result) => result.status === "fulfilled").length;
    const failed = results.filter((result) => result.status === "rejected").length;
    if (sent === 0 && failed > 0) {
      await supabase.from("push_notification_events").delete().eq("event_key", eventKey);
    }

    return json(request, {
      ok: true,
      duplicate: false,
      sent,
      failed,
    });
  } catch (error) {
    console.error("notify-push", error);
    return json(request, { error: "Erreur serveur" }, 500);
  }
});
