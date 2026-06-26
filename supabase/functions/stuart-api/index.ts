import { adminClient, allowedRequest, corsHeaders, json, safeTaskUrl, validText } from "../_shared/http.ts";

type StuartAction = "create-delivery" | "track-delivery" | "cancel-delivery" | "get-delivery";

type StuartResponse = {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
};

const DEFAULT_API_BASE = "https://api.stuart.com/v2";
const DEFAULT_AUTH_URL = "https://api.stuart.com/oauth/token";
const TOKEN_PROVIDER = "stuart";

class StuartConfigError extends Error {}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Méthode refusée" }, 405);
  if (!allowedRequest(request)) return json(request, { error: "Accès refusé" }, 401);

  let action: StuartAction | "" = "";
  let taskId = "";
  let createdBy = "system";
  let payload: Record<string, unknown> = {};

  try {
    const body = await request.json();
    action = String(body.action || "").trim() as StuartAction;
    taskId = typeof body.task_id === "string" ? body.task_id : "";
    createdBy = typeof body.created_by === "string" && body.created_by ? body.created_by : "system";
    payload = typeof body.payload === "object" && body.payload !== null ? body.payload : {};

    if (!["create-delivery", "track-delivery", "cancel-delivery", "get-delivery"].includes(action)) {
      return json(request, { error: "Action Stuart inconnue" }, 400);
    }
    if (!validText(taskId, 120)) return json(request, { error: "task_id manquant" }, 400);

    const result = await callStuart(action, payload);
    await logStuartCall(action, taskId, createdBy, payload, result).catch((error) => console.error("stuart-api-log", error));

    if (!result.ok) {
      return json(request, { ok: false, error: result.error || "Erreur Stuart", status: result.status, data: result.data }, 502);
    }

    return json(request, {
      ok: true,
      action,
      task_id: taskId,
      status: result.status,
      data: result.data,
      url: safeTaskUrl(`#task-${taskId}`),
    });
  } catch (error) {
    console.error("stuart-api", error);
    const message = error instanceof Error ? error.message : "Erreur serveur";
    await logStuartCall(action || "unknown", taskId, createdBy, payload, {
      ok: false,
      status: error instanceof StuartConfigError ? 400 : 500,
      data: null,
      error: message,
    }).catch(() => {});
    return json(request, { error: message || "Erreur serveur Stuart" }, error instanceof StuartConfigError ? 400 : 500);
  }
});

async function callStuart(action: StuartAction, payload: Record<string, unknown>): Promise<StuartResponse> {
  if (action === "create-delivery" && payload.test_mode === true) {
    return {
      ok: true,
      status: 200,
      data: {
        id: `test_${crypto.randomUUID()}`,
        status: "test_created",
        created_at: new Date().toISOString(),
        tracking_url: "https://steven77726.github.io/WINESS-HUB/#view-rubrique-livraison",
        test_mode: true,
      },
    };
  }

  const baseUrl = (Deno.env.get("STUART_API_BASE_URL") || DEFAULT_API_BASE).replace(/\/$/, "");

  if (action === "create-delivery") {
    const body = buildCreateDeliveryPayload(payload);
    const token = await getStuartAccessToken();
    return fetchStuart(`${baseUrl}/jobs`, "POST", token, body);
  }

  const token = await getStuartAccessToken();
  const jobId = validText(payload.job_id, 180) ? String(payload.job_id) : validText(payload.stuart_job_id, 180) ? String(payload.stuart_job_id) : "";
  if (!jobId) return { ok: false, status: 400, data: null, error: "Identifiant course Stuart manquant" };

  if (action === "cancel-delivery") return fetchStuart(`${baseUrl}/jobs/${encodeURIComponent(jobId)}/cancel`, "POST", token, { reason: payload.reason || "Canceled from Winess Hub" });
  if (action === "track-delivery") return fetchStuart(`${baseUrl}/jobs/${encodeURIComponent(jobId)}/tracking`, "GET", token);
  return fetchStuart(`${baseUrl}/jobs/${encodeURIComponent(jobId)}`, "GET", token);
}

function buildCreateDeliveryPayload(payload: Record<string, unknown>) {
  const contact = objectValue(payload.delivery_contact);
  const pickup = buildPickup(payload);
  const products = Array.isArray(payload.products) ? payload.products : [];
  const packageDescription = products
    .map((product) => objectValue(product))
    .map((product) => `${String(product.name || "Produit")} x${Number(product.requested || 0) || 1}`)
    .join(", ");
  const dropoff = buildDropoff(contact, payload, packageDescription);
  if ((Deno.env.get("STUART_PAYLOAD_FORMAT") || "nested") === "flat") {
    return {
      account_id: Deno.env.get("STUART_ACCOUNT_ID"),
      pickup,
      dropoff,
      package_description: dropoff.package_description,
      client_reference: dropoff.client_reference,
      scheduled_at: payload.scheduled_at || null,
      metadata: buildMetadata(payload),
    };
  }

  return {
    job: {
      account_id: Deno.env.get("STUART_ACCOUNT_ID"),
      pickups: [pickup],
      dropoffs: [dropoff],
      scheduled_at: payload.scheduled_at || null,
      metadata: buildMetadata(payload),
    },
  };
}

function buildPickup(payload: Record<string, unknown>) {
  const pickup = objectValue(payload.pickup);
  const address = stringEnv("STUART_PICKUP_ADDRESS") || String(pickup.address || "");
  const city = stringEnv("STUART_PICKUP_CITY") || String(pickup.city || "");
  const postcode = stringEnv("STUART_PICKUP_POSTCODE") || stringEnv("STUART_PICKUP_POSTAL_CODE") || String(pickup.postcode || pickup.postal_code || "");
  const phone = stringEnv("STUART_PICKUP_PHONE") || String(pickup.phone || "");
  if (!address) throw new StuartConfigError("Adresse d’enlèvement Stuart manquante.");
  if (!city) throw new StuartConfigError("Ville d’enlèvement Stuart manquante.");
  if (!postcode) throw new StuartConfigError("Code postal d’enlèvement Stuart manquant.");
  if (!phone) throw new StuartConfigError("Téléphone d’enlèvement Stuart manquant.");
  return {
    address,
    address2: stringEnv("STUART_PICKUP_ADDRESS_EXTRA") || String(pickup.address2 || ""),
    postcode,
    city,
    country: stringEnv("STUART_PICKUP_COUNTRY") || "FR",
    access_code: stringEnv("STUART_PICKUP_ACCESS_CODE") || String(pickup.access_code || ""),
    comment: stringEnv("STUART_PICKUP_INSTRUCTIONS") || String(pickup.instructions || pickup.comment || ""),
    contact: {
      firstname: stringEnv("STUART_PICKUP_FIRST_NAME") || "Winess",
      lastname: stringEnv("STUART_PICKUP_LAST_NAME") || "Hub",
      company: stringEnv("STUART_PICKUP_COMPANY") || "Winess",
      phone,
      email: stringEnv("STUART_PICKUP_EMAIL"),
    },
  };
}

function buildDropoff(contact: Record<string, unknown>, payload: Record<string, unknown>, packageDescription: string) {
  const comments = [
    contact.courierInstructions || contact.instructions || "",
    payload.extra_instructions || "",
    payload.contains_alcohol === true ? "Contient de l'alcool" : "",
    payload.fragile === true ? "Fragile" : "",
  ].filter(Boolean).join(" · ");
  const packageType = String(payload.package_type || Deno.env.get("STUART_PACKAGE_TYPE") || "small");
  return {
    address: String(contact.address || ""),
    address2: String(contact.address2 || ""),
    postcode: String(contact.postcode || contact.postal_code || ""),
    city: String(contact.city || ""),
    country: String(contact.country || "FR"),
    access_code: String(contact.accessCode || contact.access_code || ""),
    floor: String(contact.floor || ""),
    has_elevator: contact.elevator === "Oui" ? true : contact.elevator === "Non" ? false : undefined,
    comment: comments,
    package_type: packageType,
    package_size: String(payload.package_size || ""),
    package_description: String(payload.package_description || packageDescription || payload.title || "Livraison Winess"),
    contains_alcohol: payload.contains_alcohol === true,
    fragile: payload.fragile === true,
    client_reference: String(payload.client_reference || payload.linked_order_id || payload.task_id || ""),
    contact: {
      firstname: String(contact.firstName || contact.firstname || ""),
      lastname: String(contact.lastName || contact.lastname || ""),
      company: String(contact.company || ""),
      phone: String(contact.phone || ""),
    },
  };
}

function buildMetadata(payload: Record<string, unknown>) {
  return {
    source: "winess-hub",
    task_id: payload.task_id || "",
    linked_order_id: payload.linked_order_id || "",
    linked_order_title: payload.linked_order_title || "",
  };
}

async function fetchStuart(url: string, method: string, token: string, body?: unknown): Promise<StuartResponse> {
  const headers = new Headers({ Authorization: `Bearer ${token}`, Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");

  const accountId = Deno.env.get("STUART_ACCOUNT_ID");
  const accountHeader = Deno.env.get("STUART_ACCOUNT_HEADER") || "X-Account-ID";
  if (accountId) headers.set(accountHeader, accountId);

  const response = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await readJsonSafe(response);
  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? undefined : errorMessage(data) || response.statusText,
  };
}

async function getStuartAccessToken() {
  const supabase = adminClient();
  const now = Date.now();
  const { data } = await supabase.from("stuart_oauth_tokens").select("access_token,expires_at,token_type").eq("provider", TOKEN_PROVIDER).maybeSingle();

  if (data?.access_token && new Date(data.expires_at).getTime() > now + 60_000) return data.access_token;

  const clientId = Deno.env.get("STUART_CLIENT_ID");
  const clientSecret = Deno.env.get("STUART_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Secrets Stuart absents");

  const authUrl = Deno.env.get("STUART_AUTH_URL") || DEFAULT_AUTH_URL;
  const form = new URLSearchParams({ grant_type: "client_credentials" });
  const scope = Deno.env.get("STUART_OAUTH_SCOPE");
  const audience = Deno.env.get("STUART_OAUTH_AUDIENCE");
  if (scope) form.set("scope", scope);
  if (audience) form.set("audience", audience);
  const headers = new Headers({ "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" });
  if ((Deno.env.get("STUART_AUTH_STYLE") || "basic") === "body") {
    form.set("client_id", clientId);
    form.set("client_secret", clientSecret);
  } else {
    headers.set("Authorization", `Basic ${btoa(`${clientId}:${clientSecret}`)}`);
  }

  const response = await fetch(authUrl, {
    method: "POST",
    headers,
    body: form,
  });
  const tokenData = objectValue(await readJsonSafe(response));
  if (!response.ok || !tokenData.access_token) throw new Error(errorMessage(tokenData) || "Authentification Stuart refusée");

  const expiresIn = Number(tokenData.expires_in || 3600);
  const expiresAt = new Date(Date.now() + Math.max(60, expiresIn - 30) * 1000).toISOString();
  const tokenType = String(tokenData.token_type || "Bearer");
  const { error } = await supabase.from("stuart_oauth_tokens").upsert({
    provider: TOKEN_PROVIDER,
    access_token: String(tokenData.access_token),
    token_type: tokenType,
    scope: typeof tokenData.scope === "string" ? tokenData.scope : scope || null,
    expires_at: expiresAt,
  });
  if (error) throw error;

  return String(tokenData.access_token);
}

async function logStuartCall(action: string, taskId: string, createdBy: string, requestPayload: unknown, result: StuartResponse) {
  const supabase = adminClient();
  await supabase.from("stuart_api_logs").insert({
    action,
    task_id: taskId || null,
    ok: result.ok,
    status_code: result.status,
    request_payload: redactPayload(requestPayload),
    response_payload: result.data,
    error_message: result.error || null,
    created_by: createdBy,
  });
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function readJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 2000) };
  }
}

function errorMessage(value: unknown) {
  const object = objectValue(value);
  return String(object.error_description || object.error || object.message || "");
}

function stringEnv(name: string) {
  return Deno.env.get(name)?.trim() || "";
}

function redactPayload(value: unknown) {
  const clone = JSON.parse(JSON.stringify(value || {}));
  if (clone?.delivery_contact?.phone) clone.delivery_contact.phone = maskPhone(String(clone.delivery_contact.phone));
  if (clone?.dropoff?.phone) clone.dropoff.phone = maskPhone(String(clone.dropoff.phone));
  return clone;
}

function maskPhone(value: string) {
  return value.length <= 4 ? "****" : `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}
