import webpush from "npm:web-push@3.6.7";
import { adminClient, allowedRequest, corsHeaders, eventKeyFor, json, safeTaskUrl, validText, validUserId } from "../_shared/http.ts";

let apnsJwtCache: { token: string; createdAt: number } | null = null;

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

    const { data, error } = await supabase.from("push_subscriptions").select("id,endpoint,subscription").eq("user_id", userId);
    if (error) throw error;
    const results = await Promise.allSettled((data || []).map(async (row) => {
      try {
        const notificationUrl = safeTaskUrl(url);
        if (row.subscription?.type === "apns" || String(row.endpoint || "").startsWith("apns:")) {
          await sendApnsNotification(row.subscription?.token || String(row.endpoint || "").replace(/^apns:/, ""), {
            title,
            body,
            url: notificationUrl,
            eventId: eventKey,
          });
          return;
        }
        await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url: notificationUrl, event_id: eventKey }));
      } catch (pushError: unknown) {
        const statusCode = typeof pushError === "object" && pushError !== null && "statusCode" in pushError ? Number(pushError.statusCode) : 0;
        if ([404, 410].includes(statusCode)) await supabase.from("push_subscriptions").delete().eq("id", row.id);
        if (row.subscription?.type === "apns" && [400, 403, 410].includes(statusCode)) await supabase.from("push_subscriptions").delete().eq("id", row.id);
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

async function sendApnsNotification(deviceToken: string, payload: { title: string; body: string; url: string; eventId: string }) {
  if (!/^[a-f0-9]{32,256}$/i.test(deviceToken || "")) throw Object.assign(new Error("Token APNs invalide"), { statusCode: 400 });
  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const bundleId = Deno.env.get("APNS_BUNDLE_ID") || "fr.winesshub.app";
  const privateKey = Deno.env.get("APNS_PRIVATE_KEY");
  if (!keyId || !teamId || !bundleId || !privateKey) throw new Error("Secrets APNs absents");

  const jwt = await apnsJwt(teamId, keyId, privateKey);
  const sandbox = ["1", "true", "yes"].includes(String(Deno.env.get("APNS_USE_SANDBOX") || "").toLowerCase());
  const host = sandbox ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  const response = await fetch(`${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: "default",
        badge: 1,
      },
      url: payload.url,
      taskId: taskIdFromUrl(payload.url),
      messageId: messageIdFromUrl(payload.url),
      event_id: payload.eventId,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw Object.assign(new Error(`APNs ${response.status} ${text}`), { statusCode: response.status });
  }
}

async function apnsJwt(teamId: string, keyId: string, privateKeyPem: string) {
  const now = Math.floor(Date.now() / 1000);
  if (apnsJwtCache && now - apnsJwtCache.createdAt < 45 * 60) return apnsJwtCache.token;
  const header = base64UrlJson({ alg: "ES256", kid: keyId });
  const claims = base64UrlJson({ iss: teamId, iat: now });
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(signingInput));
  const token = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
  apnsJwtCache = { token, createdAt: now };
  return token;
}

function pemToArrayBuffer(value: string) {
  const normalized = value.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(normalized);
  return Uint8Array.from([...binary].map((char) => char.charCodeAt(0))).buffer;
}

function base64UrlJson(value: Record<string, unknown>) {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function taskIdFromUrl(value: string) {
  return decodeURIComponent(value.match(/#task-([^&]+)/)?.[1] || "");
}

function messageIdFromUrl(value: string) {
  return decodeURIComponent(value.match(/[&?]message=([^&]+)/)?.[1] || "");
}
