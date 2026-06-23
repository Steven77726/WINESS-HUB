const STORAGE_KEY = "winess-hub:v260";
const CURRENT_USER = "Steven";
const TWO_HOURS = 2 * 60 * 60 * 1000;
const PUSH_API_BASE = "https://winess-hub-push.example.com";
const VAPID_PUBLIC_KEY = "REMPLACE_MOI_PAR_LA_CLE_VAPID_PUBLIQUE";

const MISSION_TYPES = {
  preparation: { label: "📦 Préparation commande", statuses: ["Attribué", "En cours", "Prête", "Récupérée", "Terminée"] },
  blocage: { label: "📌 Blocage produit", statuses: ["Demandé", "Bloqué", "Récupéré"] },
  livraison: { label: "🚚 Livraison", statuses: ["À préparer", "Prêt départ", "En livraison", "Livré"] },
  inventaire: { label: "📊 Inventaire", statuses: ["Attribué", "En cours", "Terminé"] },
  rappel: { label: "📞 Rappel client", statuses: ["Attribué", "Pris en charge", "Terminé"] },
  litige: { label: "⚠️ Litige", statuses: ["Attribué", "Pris en charge", "Terminé"] },
  fournisseur: { label: "🛒 Commande fournisseur", statuses: ["Attribué", "En cours", "Commandée", "Terminée"] },
  instagram: { label: "📱 Relance Instagram", statuses: ["Attribué", "Pris en charge", "Terminé"] },
  autre: { label: "📋 Autre", statuses: ["Attribué", "Pris en charge", "Terminé"] }
};

const members = [
  { id: "david", name: "David", role: "Direction", group: "direction" },
  { id: "valerie", name: "Valérie", role: "Direction", group: "direction" },
  { id: "zac", name: "Zac", role: "Direction", group: "direction" },
  { id: "steven", name: "Steven", role: "Staff", group: "staff" },
  { id: "theo", name: "Théo", role: "Staff", group: "staff" }
];

const seedTasks = [
  task("azran", "Préparer commande Azran", "preparation", "Théo", "David", "🔥 Urgente", "Aujourd'hui 15h", "Préparer la commande magasin.", 25, "Attribué", 12, 10),
  task("azul", "Vérifier stock Azul", "inventaire", "Steven", "Zac", "🔥 Urgente", "Aujourd'hui 15h", "Contrôler le disponible réel.", 90, "En cours"),
  task("litige", "Valider litige fournisseur", "litige", "David", "Steven", "Haute", "Aujourd'hui 16h", "Écart de prix à arbitrer.", 140),
  task("cohen", "Rappeler Madame Cohen", "rappel", "Zac", "Steven", "🔥 Urgente", "Aujourd'hui 17h", "Client à rappeler avant 18h.", 40),
  task("facture", "Contrôler anomalie facture", "autre", "Valérie", "David", "Normale", "Demain matin", "Vérifier le montant.", 12)
];

const sampleTools = {
  commandes: [["Commande Azran", "2 coffrets · stock à confirmer"], ["Commande Azul", "Réservation en attente"]],
  livraisons: [["Livraison hôtel", "Aujourd'hui 15h · Steven"], ["Départ Neuilly", "Adresse confirmée"]],
  rappels: [["Rappeler Madame Cohen", "Aujourd'hui 17h · Zac"], ["Relance Instagram", "Aujourd'hui 18h"]],
  stock: [["Azran assortiment", "Stock 24 · réservé 7 · disponible 17"], ["Pistaches", "Stock 18 · disponible 7"]]
};

const state = loadState();
let selectedAvatar = "";

const el = {
  direction: document.querySelector("#directionGrid"),
  staff: document.querySelector("#staffGrid"),
  urgent: document.querySelector("#urgentList"),
  myTasks: document.querySelector("#myTasksList"),
  badge: document.querySelector("#myTasksBadge"),
  activity: document.querySelector("#activityList"),
  archives: document.querySelector("#archivesList"),
  memberDialog: document.querySelector("#memberDialog"),
  memberDetails: document.querySelector("#memberDetails"),
  taskDialog: document.querySelector("#taskDialog"),
  taskDetails: document.querySelector("#taskDetails"),
  avatarUpload: document.querySelector("#avatarUpload"),
  iphoneHelp: document.querySelector("#iphoneHelp")
};

render();
bindGlobal();
handleHash();
registerServiceWorker();

function task(id, title, missionType, assignee, createdBy, priority, due, notes, minutesAgo, status, requested = 0, available = 0) {
  return { id, title, missionType, assignee, createdBy, priority, due, notes, status: status || statusesForType(missionType)[0], requested, available, createdAt: Date.now() - minutesAgo * 60000, seenBy: [], history: [`Créée par ${createdBy} — ${dateTimeNow()}`] };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { tasks: saved.tasks || seedTasks, avatars: saved.avatars || {}, activity: saved.activity || [] };
  } catch {
    return { tasks: seedTasks, avatars: {}, activity: [] };
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  renderUrgencies();
  el.direction.innerHTML = members.filter((m) => m.group === "direction").map(memberCard).join("");
  el.staff.innerHTML = members.filter((m) => m.group === "staff").map(memberCard).join("");
  renderMyTasks();
  renderTools();
  renderActivity();
  bindRendered();
}

function activeTasksFor(name) {
  return state.tasks.filter((item) => item.assignee === name && !isCompleted(item));
}

function isOverdue(item) {
  return isInitialStatus(item) && Date.now() - item.createdAt > TWO_HOURS;
}

function statusesForType(type) {
  return (MISSION_TYPES[type] || MISSION_TYPES.autre).statuses;
}

function statusesFor(item) {
  return statusesForType(item.missionType);
}

function isInitialStatus(item) {
  return item.status === statusesFor(item)[0];
}

function isCompleted(item) {
  return ["Terminée", "Terminé", "Livré", "Récupéré", "Récupérée"].includes(item.status);
}

function nextStatuses(item) {
  const statuses = statusesFor(item);
  const index = Math.max(0, statuses.indexOf(item.status));
  return statuses.slice(index + 1, index + 3);
}

function typeLabel(item) {
  return (MISSION_TYPES[item.missionType] || MISSION_TYPES.autre).label;
}

function missingQuantity(item) {
  return Math.max(0, Number(item.requested || 0) - Number(item.available || 0));
}

function renderUrgencies() {
  const urgent = state.tasks.filter((item) => item.priority.includes("Urgente") && !isCompleted(item));
  el.urgent.innerHTML = urgent.slice(0, 4).map((item) => `<button class="urgency-item" data-open-task="${item.id}" type="button"><strong>🔥 ${item.title}</strong><span>${item.due} · ${item.assignee}</span></button>`).join("") || `<span class="empty-state">Aucune urgence active.</span>`;
}

function memberCard(member) {
  const tasks = activeTasksFor(member.name);
  const avatar = state.avatars[member.id];
  return `<article class="employee-card ${member.group}" data-member="${member.id}">
    <div class="employee-top">
      <button class="photo" data-avatar="${member.id}" type="button" aria-label="Changer la photo de ${member.name}">
        ${avatar ? `<img src="${avatar}" alt="${member.name}">` : `<span>${member.name[0]}</span>`}
        ${tasks.length ? `<span class="task-badge">${tasks.length}</span>` : ""}
      </button>
      <button class="profile-plus" data-add-task="${member.name}" type="button">+</button>
    </div>
    <div class="employee-tags">
      ${tasks.slice(0, 3).map((item) => `<button class="task-chip ${isOverdue(item) || item.priority.includes("Urgente") ? "urgent" : ""}" data-open-task="${item.id}" type="button">${isOverdue(item) ? "⏰ " : item.priority.includes("Urgente") ? "🔥 " : ""}${item.title}</button>`).join("") || `<span class="empty-chip">Aucune tâche active</span>`}
      ${tasks.length > 3 ? `<button class="task-chip more-chip" data-member="${member.id}" type="button">+${tasks.length - 3} autres</button>` : ""}
    </div>
    <div class="employee-bottom"><div><h3>${member.name}</h3><p>${member.role}</p></div></div>
  </article>`;
}

function renderMyTasks() {
  const tasks = activeTasksFor(CURRENT_USER);
  el.badge.textContent = tasks.length;
  el.myTasks.innerHTML = tasks.map(toolTask).join("") || `<p class="empty-state">Aucune tâche active.</p>`;
}

function toolTask(item) {
  return `<article class="tool-card ${isOverdue(item) ? "red" : "gold"}">
    <button class="task-title-button" data-open-task="${item.id}" type="button">${item.title}</button>
    <p>${typeLabel(item)} · ${item.status} · par ${item.createdBy} · ${item.due}</p>
    ${missingQuantity(item) ? `<p class="missing-alert">⚠️ Manquant : ${missingQuantity(item)}</p>` : ""}
    <div class="task-actions-row">${nextStatuses(item).map((status) => `<button data-status="${item.id}:${status}" type="button">${status}</button>`).join("")}</div>
  </article>`;
}

function renderTools() {
  Object.entries(sampleTools).forEach(([name, items]) => {
    const target = document.querySelector(`#${name}List`);
    if (target) target.innerHTML = items.map(([title, meta]) => `<article class="tool-card gold"><strong>${title}</strong><p>${meta}</p></article>`).join("");
  });
  el.archives.innerHTML = state.tasks.filter(isCompleted).map(toolTask).join("") || `<p class="empty-state">Aucune tâche terminée.</p>`;
}

function renderActivity() {
  const events = state.activity.length ? state.activity : [{ time: "14:01", text: "Didier a créé Commande Azran" }, { time: "14:22", text: "Steven a vu Vérifier stock Azul" }];
  el.activity.innerHTML = events.map((event) => `<article class="activity-item"><span>${event.time}</span><p>${event.text}</p></article>`).join("");
}

function bindRendered() {
  document.querySelectorAll("[data-open-task]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); openTask(button.dataset.openTask); }));
  document.querySelectorAll("[data-add-task]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); openCreator(button.dataset.addTask); }));
  document.querySelectorAll("[data-avatar]").forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); selectedAvatar = button.dataset.avatar; el.avatarUpload.click(); }));
  document.querySelectorAll("[data-member]").forEach((card) => card.addEventListener("click", () => openMember(card.dataset.member)));
  document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => updateStatus(button.dataset.status)));
}

function openCreator(assignee) {
  el.taskDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">Nouvelle tâche</p><h2>Attribuer à ${assignee}</h2></div></header>
    <form class="task-form" id="taskForm">
      <label>Titre<input name="title" required placeholder="Préparer commande"></label>
      <label>Type de mission<select name="missionType">${Object.entries(MISSION_TYPES).map(([key, type]) => `<option value="${key}">${type.label}</option>`).join("")}</select></label>
      <label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>🔥 Urgente</option></select></label>
      <label>Date / heure<input name="due" placeholder="Aujourd'hui 18h"></label>
      <label>Quantité demandée<input name="requested" type="number" min="0" inputmode="numeric" placeholder="12"></label>
      <label>Disponible<input name="available" type="number" min="0" inputmode="numeric" placeholder="10"></label>
      <label class="wide">Notes<textarea name="notes" placeholder="Ajouter une note"></textarea></label>
      <button class="primary-action visible" type="submit">Créer la tâche</button>
    </form>`;
  document.querySelector("#taskForm").addEventListener("submit", (event) => createTask(event, assignee));
  el.taskDialog.showModal();
}

function createTask(event, assignee) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const missionType = form.get("missionType");
  const item = { id: `task-${Date.now()}`, title: form.get("title"), missionType, assignee, createdBy: CURRENT_USER, priority: form.get("priority"), due: form.get("due") || "À planifier", notes: form.get("notes"), requested: Number(form.get("requested") || 0), available: Number(form.get("available") || 0), status: statusesForType(missionType)[0], createdAt: Date.now(), seenBy: [], history: [`Créée par ${CURRENT_USER} — ${dateTimeNow()}`] };
  state.tasks.unshift(item);
  addActivity(`${CURRENT_USER} a créé ${item.title} pour ${assignee}`);
  if (missingQuantity(item)) addActivity(`⚠️ ${item.title} : manquant ${missingQuantity(item)}`);
  save(); render(); el.taskDialog.close();
  sendPush(assignee, "Nouvelle tâche Winess Hub", `${CURRENT_USER} t’a assigné : ${item.title}`, `#task-${item.id}`);
}

function openTask(id) {
  let item = state.tasks.find((task) => task.id === id);
  if (!item) return;
  if (!item.seenBy.some((seen) => seen.user === CURRENT_USER)) {
    item.seenBy.push({ user: CURRENT_USER, date: dateNow(), time: timeNow() });
    item.history.push(`👁 Vu par ${CURRENT_USER} — ${dateTimeNow()}`);
    addActivity(`${CURRENT_USER} a vu ${item.title}`);
    save(); render();
    item = state.tasks.find((task) => task.id === id);
  }
  el.taskDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">${typeLabel(item)}</p><h2>${item.title}</h2><p class="assignment-line">Assigné à ${item.assignee} par ${item.createdBy} <button class="whatsapp-share" id="shareTask" type="button">WhatsApp</button></p></div></header>
    <section class="task-detail-grid"><article><span>Statut</span><strong>${item.status}</strong></article><article><span>Priorité</span><strong>${item.priority}</strong></article><article><span>Date</span><strong>${item.due}</strong></article><article><span>Créée</span><strong>${new Date(item.createdAt).toLocaleString("fr-FR")}</strong></article></section>
    ${item.requested || item.available ? `<section class="quantity-status"><article><span>Demandé</span><strong>${item.requested || 0}</strong></article><article><span>Disponible</span><strong>${item.available || 0}</strong></article><article class="${missingQuantity(item) ? "has-missing" : ""}"><span>Manquant</span><strong>${missingQuantity(item)}</strong></article></section>` : ""}
    ${missingQuantity(item) ? `<section class="missing-banner">⚠️ Produit manquant : ${missingQuantity(item)}</section>` : ""}
    <section class="read-status"><h3>Vu par</h3>${item.seenBy.map((seen) => `<p>👁 Vu par ${seen.user} — ${seen.date || dateNow()} ${seen.time}</p>`).join("") || `<p>Pas encore vue</p>`}</section>
    <section class="task-form single"><label>Notes<textarea id="taskNotes">${item.notes || ""}</textarea></label><div class="quantity-edit"><label>Demandé<input id="taskRequested" type="number" min="0" value="${item.requested || 0}"></label><label>Disponible<input id="taskAvailable" type="number" min="0" value="${item.available || 0}"></label></div><label>Statut<select id="taskStatus">${statusesFor(item).map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></label></section>
    <div class="task-form-actions"><button id="saveTask" type="button">Valider</button><button id="shareTaskBottom" class="whatsapp-action" type="button">Partager WhatsApp</button></div>
    <details class="task-history"><summary>Historique</summary>${item.history.map((line) => `<p>${line}</p>`).join("")}</details>`;
  document.querySelector("#saveTask").addEventListener("click", () => saveTaskDetails(item));
  document.querySelector("#shareTask").addEventListener("click", () => shareTask(item));
  document.querySelector("#shareTaskBottom").addEventListener("click", () => shareTask(item));
  el.taskDialog.showModal();
}

function saveTaskDetails(item) {
  const previousStatus = item.status;
  const previousMissing = missingQuantity(item);
  item.notes = document.querySelector("#taskNotes").value;
  item.requested = Number(document.querySelector("#taskRequested").value || 0);
  item.available = Number(document.querySelector("#taskAvailable").value || 0);
  item.status = document.querySelector("#taskStatus").value;
  item.history.push(`Modifiée par ${CURRENT_USER} — ${dateTimeNow()}`);

  if (item.status !== previousStatus) recordStatusActivity(item, item.status);
  if (missingQuantity(item) && missingQuantity(item) !== previousMissing) {
    item.history.push(`⚠️ Manquant signalé : ${missingQuantity(item)} — ${dateTimeNow()}`);
    addActivity(`${CURRENT_USER} a signalé un manquant de ${missingQuantity(item)} sur ${item.title}`);
    sendPush(item.createdBy, "Produit manquant", `${item.title} : manquant ${missingQuantity(item)}`, `#task-${item.id}`);
  }
  save(); render(); el.taskDialog.close();
}

function recordStatusActivity(item, status) {
  const wording = ["En cours", "Pris en charge", "En livraison"].includes(status)
    ? `a pris en charge ${item.title}`
    : ["Prête", "Prêt départ"].includes(status)
      ? `a indiqué ${item.title} prête`
      : ["Récupérée", "Récupéré"].includes(status)
        ? `a indiqué ${item.title} récupérée`
        : ["Terminée", "Terminé", "Livré"].includes(status)
          ? `a terminé ${item.title}`
          : `a passé ${item.title} en ${status}`;
  item.history.push(`${status} par ${CURRENT_USER} — ${dateTimeNow()}`);
  addActivity(`${CURRENT_USER} ${wording}`);
  if (["Prête", "Prêt départ"].includes(status)) sendPush(item.createdBy, "Commande prête", `${item.title} est prête`, `#task-${item.id}`);
  if (isCompleted(item)) sendPush(item.createdBy, "Mission terminée", `${item.title} : ${status}`, `#task-${item.id}`);
}

function shareTask(item) {
  const url = `https://steven77726.github.io/WINESS-HUB/#task-${item.id}`;
  const text = `Mission : ${item.title}\nAssigné à : ${item.assignee}\nAssigné par : ${item.createdBy}\nStatut : ${item.status}\nPriorité : ${item.priority}\nDate : ${item.due}\nNotes : ${item.notes || "Aucune"}\nLien : ${url}`;
  if (navigator.share) navigator.share({ title: item.title, text, url }).catch(() => {}); else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

function updateStatus(value) {
  const [id, status] = value.split(":");
  const item = state.tasks.find((task) => task.id === id);
  if (!item) return;
  item.status = status;
  recordStatusActivity(item, status);
  save(); render();
}

function openMember(id) {
  const member = members.find((item) => item.id === id);
  if (!member) return;
  const tasks = state.tasks.filter((item) => item.assignee === member.name);
  el.memberDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">Profil</p><h2>${member.name}</h2><p>${member.role}</p></div></header><section class="task-list"><h3>En cours</h3>${tasks.filter((item) => !isCompleted(item)).map(toolTask).join("") || `<p>Aucune tâche.</p>`}</section><details class="profile-done"><summary>Terminées</summary>${tasks.filter(isCompleted).map(toolTask).join("") || `<p>Aucune tâche terminée.</p>`}</details>`;
  el.memberDetails.querySelectorAll("[data-open-task]").forEach((button) => button.addEventListener("click", () => openTask(button.dataset.openTask)));
  el.memberDialog.showModal();
}

function bindGlobal() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close()));
  document.querySelector("#sidebarToggle").addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));
  document.querySelector("#enablePushButton").addEventListener("click", enablePush);
  el.avatarUpload.addEventListener("change", updateAvatar);
  window.addEventListener("hashchange", handleHash);
  if (matchMedia("(max-width: 900px)").matches) document.body.classList.add("sidebar-collapsed");
}

function showView(name) {
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === name));
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === name));
  location.hash = `view-${name}`;
}

function handleHash() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("task-")) return openTask(hash.slice(5));
  if (hash.startsWith("view-")) return showView(hash.slice(5));
  showView("accueil");
}

function updateAvatar(event) {
  const file = event.target.files?.[0];
  if (!file || !selectedAvatar) return;
  const reader = new FileReader();
  reader.onload = () => { state.avatars[selectedAvatar] = reader.result; save(); render(); };
  reader.readAsDataURL(file);
}

async function enablePush() {
  el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Pour recevoir les notifications iPhone, ouvrez Winess Hub dans Safari, cliquez sur Partager, puis Ajouter à l’écran d’accueil.</span>`;
  el.iphoneHelp.classList.add("is-visible");
  if (!matchMedia("(display-mode: standalone)").matches && navigator.standalone !== true) return;
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (VAPID_PUBLIC_KEY.includes("REMPLACE_MOI") || PUSH_API_BASE.includes("example.com")) {
    el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Le site est prêt. Il reste à renseigner l’URL du backend et la clé VAPID publique.</span>`;
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID_PUBLIC_KEY) });
  await fetch(`${PUSH_API_BASE}/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: "steven", subscription }) });
  el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Notifications activées.</span>`;
}

async function sendPush(userName, title, body, url) {
  if (PUSH_API_BASE.includes("example.com")) return;
  const user = members.find((member) => member.name === userName);
  if (!user) return;
  try {
    await fetch(`${PUSH_API_BASE}/notify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.id, title, body, url }) });
  } catch {}
}

function base64ToBytes(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function addActivity(text) { state.activity.unshift({ time: timeNow(), text }); }
function timeNow() { return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date()); }
function dateNow() { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()); }
function dateTimeNow() { return `${dateNow()} ${timeNow()}`; }
function registerServiceWorker() { if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {})); }
