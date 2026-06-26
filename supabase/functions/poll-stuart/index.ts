import { adminClient, allowedRequest, corsHeaders, json } from "../_shared/http.ts";

type HubTaskRow = {
  id: string;
  status?: string | null;
  data?: Record<string, unknown> | null;
};

type StuartCourse = {
  status: string;
  mappedStatus: string;
  trackingUrl: string;
  eta: string;
  updatedAt: string;
};

const APP_BASE_URL = "https://steven77726.github.io/WINESS-HUB/";
const FINAL_NOTIFY_STATUSES = new Set(["Livrée", "Annulée", "Incident"]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Méthode refusée" }, 405);
  if (!allowedRequest(request)) return json(request, { error: "Accès refusé" }, 401);

  try {
    const supabase = adminClient();
    const { data: rows, error } = await supabase.from("hub_tasks").select("id,status,data").order("updated_at", { ascending: false }).limit(200);
    if (error) throw error;

    let checked = 0;
    let updated = 0;
    let notified = 0;

    for (const row of (rows || []) as HubTaskRow[]) {
      const task = row.data || {};
      if (!isTrackable(task)) continue;
      checked += 1;

      let course: StuartCourse;
      try {
        course = await getStuartCourse(row.id, task);
      } catch (error) {
        console.error("poll-stuart-task", row.id, error);
        continue;
      }
      if (!course.status && !course.trackingUrl && !course.eta) continue;

      const previousStatus = String(task.status || row.status || "");
      const previousStuartStatus = String(task.stuartStatus || "");
      const nextStatus = course.mappedStatus || previousStatus;
      const changed = nextStatus !== previousStatus || course.status !== previousStuartStatus || Boolean(course.trackingUrl && course.trackingUrl !== task.stuartTrackingUrl) || Boolean(course.eta && course.eta !== task.stuartEta);
      if (!changed) continue;

      const now = course.updatedAt || new Date().toISOString();
      const nextTask = {
        ...task,
        status: nextStatus,
        stuartStatus: course.status || task.stuartStatus || nextStatus,
        stuartTrackingUrl: course.trackingUrl || task.stuartTrackingUrl || "",
        stuartEta: course.eta || task.stuartEta || "",
        stuartLastSyncAt: now,
        stuartTimeline: appendTimeline(task.stuartTimeline, nextStatus, now),
        history: [
          ...arrayValue(task.history),
          `Statut Stuart : ${displayStatus(nextStatus)} — ${dateTimeParis(new Date(now).getTime())}`,
        ],
        updatedAt: now,
      };

      const { error: updateError } = await supabase.from("hub_tasks").update({
        data: nextTask,
        status: nextStatus,
        updated_by: "system",
      }).eq("id", row.id);
      if (updateError) throw updateError;
      updated += 1;

      await supabase.from("hub_activity").upsert({
        id: `activity:stuart:${row.id}:${normalizedStatusKey(nextStatus)}:${Date.parse(now) || Date.now()}`,
        event_time: timeParis(Date.now()),
        text: `Stuart a passé "${String(task.title || "Livraison")}" en ${nextStatus}`,
        created_by: "system",
      });

      if (shouldNotify(nextStatus, course.status)) {
        notified += await notifyConcernedUsers(row.id, nextTask, nextStatus, course.status);
      }
    }

    return json(request, { ok: true, checked, updated, notified });
  } catch (error) {
    console.error("poll-stuart", error);
    return json(request, { error: error instanceof Error ? error.message : "Erreur serveur" }, 500);
  }
});

function isTrackable(task: Record<string, unknown>) {
  if (task.missionType !== "livraison") return false;
  const jobId = String(task.stuartJobId || "").trim();
  if (!jobId || task.stuartTestMode === true) return false;
  if (task.deletedAt || task.archivedAt) return false;
  return !["Livrée", "Annulée", "Incident", "Erreur"].includes(String(task.status || ""));
}

async function getStuartCourse(taskId: string, task: Record<string, unknown>): Promise<StuartCourse> {
  const baseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const apiKey = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY");
  if (!baseUrl || !apiKey) throw new Error("Configuration Supabase absente");

  const response = await fetch(`${baseUrl}/functions/v1/stuart-api`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey, "x-client-info": "winess-stuart-poller" },
    body: JSON.stringify({
      action: "get-delivery",
      task_id: taskId,
      created_by: "system",
      payload: { job_id: String(task.stuartJobId || "").trim() },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result?.ok === false) throw new Error(result?.error || "Suivi Stuart indisponible");
  return extractCourse(result?.data);
}

function extractCourse(data: unknown): StuartCourse {
  const root = objectValue(data);
  const job = objectValue(root.job || root.data || data);
  const deliveries = Array.isArray(job.deliveries) ? job.deliveries : [];
  const delivery = objectValue(deliveries[0]);
  const status = String(job.status || job.state || "");
  return {
    status,
    mappedStatus: mapStuartStatus(status),
    trackingUrl: String(job.tracking_url || job.trackingUrl || objectValue(job.tracking).url || job.public_tracking_url || delivery.tracking_url || ""),
    eta: String(job.eta || job.estimated_arrival || job.estimatedArrival || job.dropoff_eta || delivery.eta || delivery.estimated_arrival || delivery.estimatedArrival || ""),
    updatedAt: String(job.updated_at || job.updatedAt || delivery.updated_at || delivery.updatedAt || new Date().toISOString()),
  };
}

function mapStuartStatus(status = "") {
  const value = normalizedStatusKey(status);
  if (value.includes("incident") || value.includes("failed") || value.includes("problem")) return "Incident";
  if (value.includes("cancel")) return "Annulée";
  if (value.includes("delivered") || value.includes("livree")) return "Livrée";
  if (value.includes("at dropoff") || value.includes("arrived at dropoff") || value.includes("client")) return "Arrivé client";
  if (value.includes("delivering") || value.includes("dropoff") || value.includes("en livraison")) return "En livraison";
  if (value.includes("picked") || value.includes("pickup complete") || value.includes("recup")) return "Commande récupérée";
  if (value.includes("arriv") || value.includes("courier at pickup")) return "Coursier arrivé";
  if (value.includes("going") || value.includes("courier") || value.includes("accepted")) return "Coursier accepté";
  return "Course demandée";
}

function shouldNotify(status: string, rawStatus: string) {
  const key = normalizedStatusKey(rawStatus);
  return FINAL_NOTIFY_STATUSES.has(status) || key.includes("delay") || key.includes("late") || key.includes("retard");
}

async function notifyConcernedUsers(taskId: string, task: Record<string, unknown>, status: string, rawStatus: string) {
  const users = [...new Set([memberId(task.createdBy), memberId(task.assignee)].filter(Boolean))];
  let sent = 0;
  for (const userId of users) {
    const eventId = `stuart:${taskId}:${userId}:${normalizedStatusKey(status)}:${normalizedStatusKey(rawStatus)}`;
    const response = await notify(userId, taskId, task, status, eventId);
    if (response.ok) sent += 1;
  }
  return sent;
}

async function notify(userId: string, taskId: string, task: Record<string, unknown>, status: string, eventId: string) {
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const apiKey = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY");
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!apiKey || !baseUrl) throw new Error("Configuration Supabase absente");
  const recipient = contactName(objectValue(task.deliveryContact));
  const text = notificationText(status, recipient);
  return fetch(`${baseUrl}/functions/v1/notify-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey, "x-client-info": "winess-stuart-poller" },
    body: JSON.stringify({
      user_id: userId,
      title: text.title,
      body: text.body,
      url: `${APP_BASE_URL}index.html#task-${taskId}`,
      event_id: eventId,
    }),
  });
}

function notificationText(status: string, recipient: string) {
  if (status === "Livrée") return { title: "✅ Livraison terminée", body: `${recipient} a été livré.` };
  if (status === "Annulée") return { title: "❌ Livraison annulée", body: "La course Stuart a été annulée." };
  return { title: "⚠️ Incident livraison", body: "Vérifier la course Stuart." };
}

function appendTimeline(value: unknown, status: string, at: string) {
  const timeline = arrayValue(value).filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null && !Array.isArray(entry));
  const key = normalizedStatusKey(status);
  if (timeline.some((entry) => entry.key === key)) return timeline;
  return [...timeline, { key, status, at }];
}

function displayStatus(status: string) {
  const icons: Record<string, string> = {
    "Course demandée": "🟡 Recherche d'un coursier",
    "Coursier accepté": "🟢 Coursier accepté",
    "Coursier arrivé": "🟠 En route vers la boutique",
    "Commande récupérée": "🔵 Commande récupérée",
    "En livraison": "🟣 En livraison",
    "Arrivé client": "📍 Arrivé chez le client",
    "Livrée": "✅ Livrée",
    "Annulée": "❌ Annulée",
    "Incident": "⚠️ Incident",
  };
  return icons[status] || status;
}

function contactName(contact: Record<string, unknown>) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || String(contact.company || "le client");
}

function memberId(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "") || "";
}

function normalizedStatusKey(value: unknown) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function timeParis(value: number) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function dateTimeParis(value: number) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
