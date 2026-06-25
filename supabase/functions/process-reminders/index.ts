import { adminClient, allowedRequest, corsHeaders, json } from "../_shared/http.ts";

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const TWO_HOURS = 2 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const APP_BASE_URL = "https://steven77726.github.io/WINESS-HUB/";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Méthode refusée" }, 405);
  if (!allowedRequest(request)) return json(request, { error: "Accès refusé" }, 401);

  try {
    const supabase = adminClient();
    const { data: rows, error } = await supabase.from("hub_tasks").select("id,data").eq("reminder_enabled", true);
    if (error) throw error;
    const now = Date.now();
    let sent = 0;

    for (const row of rows || []) {
      const task = row.data || {};
      if (task.kind === "profile" || task.deletedAt || isFinalStatus(task.status)) continue;
      const mode = task.reminderMode || "none";
      const interval = mode === "1h" ? ONE_HOUR : mode === "2h" ? TWO_HOURS : mode === "4h" ? FOUR_HOURS : mode === "daily" ? ONE_DAY : 0;
      if (!interval || !task.assignee) continue;
      const reference = timestamp(task.lastReminderAt) || timestamp(task.createdAt) || now;
      if (now - reference < interval) continue;

      const eventId = `task:${row.id}:auto-reminder:${mode}:${Math.floor(now / interval)}`;
      const response = await notify(task.assignee, task.title || "Mission", row.id, eventId);
      if (!response.ok) continue;

      const lastReminderAt = new Date(now).toISOString();
      const historyLine = `Rappel automatique envoyé à ${task.assignee} — ${dateTimeParis(now)}`;
      const updatedTask = { ...task, reminderMode: mode, reminderEnabled: true, lastReminderAt, history: [...(task.history || []), historyLine] };
      const { error: updateError } = await supabase.from("hub_tasks").update({
        data: updatedTask,
        assigned_to: memberId(task.assignee),
        assigned_by: memberId(task.createdBy),
        status: task.status,
        reminder_mode: mode,
        reminder_enabled: true,
        last_reminder_at: lastReminderAt,
        updated_by: "system",
      }).eq("id", row.id);
      if (updateError) throw updateError;
      await supabase.from("hub_activity").upsert({
        id: `activity:${eventId}`,
        event_time: timeParis(now),
        text: `Rappel automatique envoyé à ${task.assignee} pour ${task.title}`,
        created_by: "system",
      });
      sent += 1;
    }

    return json(request, { ok: true, checked: rows?.length || 0, sent });
  } catch (error) {
    console.error("process-reminders", error);
    return json(request, { error: "Erreur serveur" }, 500);
  }
});

async function notify(userName: string, title: string, taskId: string, eventId: string) {
  const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
  const apiKey = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY");
  const baseUrl = Deno.env.get("SUPABASE_URL");
  if (!apiKey || !baseUrl) throw new Error("Configuration Supabase absente");
  return fetch(`${baseUrl}/functions/v1/notify-push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey, "x-client-info": "winess-reminder-worker" },
    body: JSON.stringify({
      user_id: memberId(userName),
      title: "Rappel Winess Hub",
      body: `Tâche non terminée : ${title}`,
      url: `${APP_BASE_URL}index.html#task-${taskId}`,
      event_id: eventId,
    }),
  });
}

function timestamp(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function memberId(name: unknown) {
  const normalized = String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized === "zac" ? "zacharie" : normalized;
}

function isFinalStatus(status: unknown) {
  const key = String(status || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  return ["valide", "validee", "validated", "prete", "prete avec manquants", "facture", "recupere", "recuperee", "recovered", "livre", "livree", "delivered", "termine", "terminee", "completed"].includes(key);
}

function timeParis(value: number) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function dateTimeParis(value: number) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
