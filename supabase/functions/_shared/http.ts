import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://steven77726.github.io",
  "capacitor://localhost",
  "ionic://localhost",
  "http://127.0.0.1:4177",
  "http://localhost:4177",
]);
const APP_BASE_URL = "https://steven77726.github.io/WINESS-HUB/";

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://steven77726.github.io",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

export function allowedRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) return false;

  const authorization = request.headers.get("authorization") || "";
  const bearerKey = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  const incomingKey = request.headers.get("apikey") || bearerKey;
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const legacyAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  return Object.values(publishableKeys).includes(incomingKey) || Boolean(legacyAnonKey && incomingKey === legacyAnonKey);
}

export function adminClient() {
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl || !secretKey) throw new Error("Configuration Supabase serveur absente");
  return createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

export function validUserId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_-]{2,64}$/i.test(value);
}

export function validText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

export function safeTaskUrl(value: unknown) {
  if (typeof value !== "string" || !value) return APP_BASE_URL;
  try {
    const source = value.startsWith("#") ? `index.html${value}` : value;
    const candidate = new URL(source, APP_BASE_URL);
    if (candidate.origin !== "https://steven77726.github.io" || !candidate.pathname.startsWith("/WINESS-HUB/")) return APP_BASE_URL;
    return candidate.href;
  } catch {
    return APP_BASE_URL;
  }
}

export async function eventKeyFor(eventId: unknown, userId: string, title: string, body: string) {
  if (typeof eventId === "string" && eventId.length > 0 && eventId.length <= 200) return eventId;
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const bytes = new TextEncoder().encode(`${userId}:${title}:${body}:${bucket}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
