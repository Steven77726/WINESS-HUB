import { adminClient, allowedRequest, corsHeaders, json, validUserId } from "../_shared/http.ts";

const PIN_PATTERN = /^\d{4}$/;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Méthode refusée" }, 405);
  if (!allowedRequest(request)) return json(request, { error: "Accès refusé" }, 401);

  try {
    const { action, user_id: userId, pin, device_id: deviceId } = await request.json();
    if (!validUserId(userId)) return json(request, { error: "Profil invalide" }, 400);
    const supabase = adminClient();
    const { data: profile, error } = await supabase.from("hub_profiles")
      .select("id,pin_hash,failed_pin_attempts,pin_locked_until")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!profile) return json(request, { error: "Profil introuvable" }, 404);
    if (action === "status") return json(request, { ok: true, has_pin: Boolean(profile.pin_hash) });
    if (!["register", "verify"].includes(action) || !PIN_PATTERN.test(String(pin || ""))) {
      return json(request, { error: "PIN invalide" }, 400);
    }

    const lockedUntil = profile.pin_locked_until ? new Date(profile.pin_locked_until).getTime() : 0;
    if (lockedUntil > Date.now()) return json(request, { error: "Trop d’essais. Réessayez dans 15 minutes." }, 423);
    const pinHash = await hashPin(userId, pin);

    if (!profile.pin_hash) {
      if (action !== "register") return json(request, { error: "Créez d’abord le PIN de ce profil." }, 409);
      await updateProfile(supabase, userId, pinHash, deviceId);
      return json(request, { ok: true, created: true });
    }
    if (action !== "verify") return json(request, { error: "Ce profil possède déjà un PIN." }, 409);

    if (!constantTimeEqual(profile.pin_hash, pinHash)) {
      const failedAttempts = Number(profile.failed_pin_attempts || 0) + 1;
      const update: Record<string, unknown> = { failed_pin_attempts: failedAttempts };
      if (failedAttempts >= MAX_ATTEMPTS) {
        update.failed_pin_attempts = 0;
        update.pin_locked_until = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
      }
      await supabase.from("hub_profiles").update(update).eq("id", userId);
      return json(request, { error: failedAttempts >= MAX_ATTEMPTS ? "Trop d’essais. Réessayez dans 15 minutes." : "PIN incorrect" }, 401);
    }

    await updateProfile(supabase, userId, profile.pin_hash, deviceId);
    return json(request, { ok: true, created: false });
  } catch (error) {
    console.error("profile-pin", error);
    return json(request, { error: "Erreur serveur" }, 500);
  }
});

async function hashPin(userId: string, pin: string) {
  const pepper = Deno.env.get("PIN_PEPPER");
  if (!pepper) throw new Error("Secret PIN_PEPPER absent");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${userId}:${pin}`));
  return [...new Uint8Array(signature)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function updateProfile(supabase: ReturnType<typeof adminClient>, userId: string, pinHash: string, deviceId: unknown) {
  const { error } = await supabase.from("hub_profiles").update({
    pin_hash: pinHash,
    last_device_id: typeof deviceId === "string" ? deviceId.slice(0, 100) : null,
    last_pin_validation_at: new Date().toISOString(),
    failed_pin_attempts: 0,
    pin_locked_until: null,
  }).eq("id", userId);
  if (error) throw error;
}
