import { adminClient, allowedRequest, corsHeaders, json, validUserId } from "../_shared/http.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Méthode refusée" }, 405);
  if (!allowedRequest(request)) return json(request, { error: "Accès refusé" }, 401);

  try {
    const { user_id: userId, subscription } = await request.json();
    const validSubscription = subscription
      && typeof subscription.endpoint === "string"
      && subscription.endpoint.startsWith("https://")
      && subscription.keys?.p256dh
      && subscription.keys?.auth;
    if (!validUserId(userId) || !validSubscription) return json(request, { error: "Abonnement invalide" }, 400);

    const supabase = adminClient();
    const { error } = await supabase.from("push_subscriptions").upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      subscription,
      updated_at: new Date().toISOString(),
    }, { onConflict: "endpoint" });
    if (error) throw error;
    return json(request, { ok: true });
  } catch (error) {
    console.error("subscribe-push", error);
    return json(request, { error: "Erreur serveur" }, 500);
  }
});
