const STORAGE_KEY = "winess-hub:v260";
let CURRENT_USER = localStorage.getItem("winess-hub:current-user") || "Steven";
const TWO_HOURS = 2 * 60 * 60 * 1000;
const SUPABASE_URL = "https://xzcshuoelidzdlihnwme.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KI7h19VdLtB2YfXBsN4bAw_9KQMxNBs";
let supabaseClient = null;
let realtimeChannel = null;
const CLIENT_ID = crypto.randomUUID?.() || `client-${Date.now()}-${Math.random()}`;
const VAPID_PUBLIC_KEY = "BDEUT7mYiel6Ns3NpHSHgegKWk7jGK43pGrM9zR_MRl_A4zbfYD9oLQbSHscM8_OVkHTkjrBVW2-m0RTBrWqrAw";

const MISSION_TYPES = {
  preparation: { label: "📦 Préparation commande", statuses: ["Attribué", "En cours", "Prête", "Récupérée", "Terminée"] },
  blocage: { label: "📌 Blocage produit", statuses: ["Demandé", "Bloqué", "Récupéré"] },
  livraison: { label: "🚚 Livraison", statuses: ["À préparer", "Prêt départ", "En livraison", "Livré"] },
  inventaire: { label: "📊 Inventaire", statuses: ["Attribué", "En cours", "Terminé"] },
  rappel: { label: "📞 Rappel client", statuses: ["Attribué", "Pris en charge", "Terminé"] },
  litige: { label: "⚠️ Litige", statuses: ["Attribué", "Pris en charge", "Terminé"] },
  fournisseur: { label: "🛒 Commande fournisseur", statuses: ["Attribué", "En cours", "Commandée", "Terminée"] },
  devis: { label: "🧾 Devis non facturés", statuses: ["À relancer", "Relancé", "Facturé"] },
  instagram: { label: "📱 Relance Instagram", statuses: ["Attribué", "Pris en charge", "Terminé"] },
  autre: { label: "📋 Autre", statuses: ["Attribué", "Pris en charge", "Terminé"] }
};

const members = [
  { id: "david", name: "David", role: "Direction", group: "direction" },
  { id: "valerie", name: "Valérie", role: "Direction", group: "direction" },
  { id: "zacharie", name: "Zac", role: "Direction", group: "direction" },
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

const state = loadState();
let selectedAvatar = "";
let openedTaskId = "";
let toastTimer = 0;

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
  iphoneHelp: document.querySelector("#iphoneHelp"),
  pushProfile: document.querySelector("#pushProfileSelect"),
  pushState: document.querySelector("#pushState"),
  rubricTitle: document.querySelector("#rubricTitle"),
  rubricSummary: document.querySelector("#rubricSummary"),
  rubricList: document.querySelector("#rubricList"),
  syncState: document.querySelector("#syncState"),
  globalSearch: document.querySelector("#globalSearch"),
  searchResults: document.querySelector("#searchResults"),
  toast: document.querySelector("#appToast")
};

save();
render();
bindGlobal();
handleHash();
registerServiceWorker();
initializeSupabase();

function task(id, title, missionType, assignee, createdBy, priority, due, notes, minutesAgo, status, requested = 0, available = 0) {
  return { id, title, missionType, assignee, createdBy, priority, due, notes, status: status || statusesForType(missionType)[0], requested, available, createdAt: Date.now() - minutesAgo * 60000, seenBy: [], history: [`Créée par ${createdBy} — ${dateTimeNow()}`] };
}

function loadState() {
  try {
    const source = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("winess-hub:v252") || "{}";
    const saved = JSON.parse(source);
    const tasks = (saved.tasks || seedTasks).map(migrateTask);
    return { tasks, avatars: saved.avatars || {}, activity: saved.activity || [] };
  } catch {
    return { tasks: seedTasks, avatars: {}, activity: [] };
  }
}

function migrateTask(item) {
  const missionType = item.missionType || legacyMissionType(item.category);
  const statuses = statusesForType(missionType);
  let status = item.status;
  if (!statuses.includes(status)) {
    if (["Nouvelle", "Vue", "Attribué"].includes(status)) status = statuses[0];
    else if (["Prise en charge", "Pris en charge", "En cours"].includes(status)) status = statuses.includes("En cours") ? "En cours" : statuses.includes("Pris en charge") ? "Pris en charge" : statuses[1];
    else if (["Terminée", "Terminé"].includes(status)) status = statuses[statuses.length - 1];
    else status = statuses[0];
  }
  return { ...item, missionType, status, seenBy: item.seenBy || [], history: item.history || [], requested: Number(item.requested || 0), available: Number(item.available || 0), amount: Number(item.amount || 0) };
}

function legacyMissionType(category = "") {
  const value = category.toLowerCase();
  if (value.includes("commande")) return "preparation";
  if (value.includes("livraison")) return "livraison";
  if (value.includes("stock") || value.includes("inventaire")) return "inventaire";
  if (value.includes("rappel")) return "rappel";
  if (value.includes("litige")) return "litige";
  if (value.includes("instagram")) return "instagram";
  if (value.includes("fournisseur")) return "fournisseur";
  if (value.includes("devis")) return "devis";
  if (value.includes("blocage")) return "blocage";
  return "autre";
}

function save(changedTask = null) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (changedTask) syncTask(changedTask);
}

function render() {
  renderUrgencies();
  el.direction.innerHTML = members.filter((m) => m.group === "direction").map(memberCard).join("");
  el.staff.innerHTML = members.filter((m) => m.group === "staff").map(memberCard).join("");
  renderMyTasks();
  renderTools();
  renderActivity();
  renderRubricCounts();
  const currentRubric = location.hash.match(/^#view-rubrique-(.+)$/)?.[1];
  if (currentRubric) renderRubric(currentRubric);
  if (el.globalSearch?.value.trim()) renderSearchResults(el.globalSearch.value);
  bindRendered();
}

function activeTasksFor(name) {
  return state.tasks.filter((item) => item.assignee === name && !isArchived(item));
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
  return ["Terminée", "Terminé", "Livré", "Récupéré", "Récupérée", "Facturé"].includes(item.status);
}

function isDeleted(item) {
  return Boolean(item.deletedAt);
}

function isArchived(item) {
  return isCompleted(item) || isDeleted(item);
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
  const urgent = state.tasks.filter((item) => item.priority.includes("Urgente") && !isArchived(item));
  el.urgent.innerHTML = urgent.slice(0, 4).map((item) => `<button class="urgency-item" data-open-task="${item.id}" type="button"><strong>🔥 ${item.title}</strong><span>${formatDue(item)} · ${item.assignee}</span></button>`).join("") || `<span class="empty-state">Aucune urgence active.</span>`;
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
    <p>${typeLabel(item)} · ${item.status} · par ${item.createdBy} · ${formatDue(item)}</p>
    ${missingQuantity(item) ? `<p class="missing-alert">⚠️ Manquant : ${missingQuantity(item)}</p>` : ""}
    <div class="task-actions-row">${nextStatuses(item).map((status) => `<button data-status="${item.id}:${status}" type="button">${status}</button>`).join("")}<button data-remind="${item.id}" type="button">Relancer</button></div>
  </article>`;
}

function renderTools() {
  el.archives.innerHTML = state.tasks.filter((item) => isCompleted(item) && !isDeleted(item)).map(archiveTask).join("") || `<p class="empty-state">Aucune tâche archivée.</p>`;
}

function archiveTask(item) {
  const label = isDeleted(item) ? "Supprimée" : item.status;
  return `<article class="tool-card archive-card"><button class="task-title-button" data-open-task="${item.id}" type="button">${item.title}</button><p>${typeLabel(item)} · ${label} · ${formatDue(item)}</p></article>`;
}

function renderRubricCounts() {
  document.querySelectorAll("[data-rubric]").forEach((button) => {
    const count = state.tasks.filter((item) => item.missionType === button.dataset.rubric && !isArchived(item)).length;
    let badge = button.querySelector(".rubric-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "rubric-count";
      button.appendChild(badge);
    }
    badge.textContent = count;
  });
}

function renderRubric(key) {
  const type = MISSION_TYPES[key] || MISSION_TYPES.autre;
  const tasks = state.tasks.filter((item) => item.missionType === key && !isArchived(item)).sort((a, b) => b.createdAt - a.createdAt);
  const active = tasks.length;
  el.rubricTitle.textContent = type.label;
  el.rubricSummary.innerHTML = `<span>${active} active${active > 1 ? "s" : ""}</span>`;
  el.rubricList.innerHTML = tasks.map(rubricCard).join("") || `<p class="empty-state">Aucune tâche dans cette rubrique.</p>`;
}

function rubricCard(item) {
  const media = [item.photo ? "Photo" : "", item.voice ? "Vocal" : ""].filter(Boolean).join(" · ");
  return `<article class="rubric-card ${isCompleted(item) ? "is-done" : ""}">
    <header><div><strong>${item.title}</strong><p>Assigné à ${item.assignee} par ${item.createdBy}</p></div><span class="workflow-badge">${workflowStage(item)}</span></header>
    <div class="rubric-meta"><span>${item.status}</span><span>${item.priority}</span><span>${formatDue(item)}</span></div>
    ${item.missionType === "devis" ? `<div class="quote-summary"><span>${item.client || "Client à préciser"}</span><strong>${formatAmount(item.amount)}</strong></div>` : ""}
    ${item.notes ? `<p class="rubric-notes">${item.notes}</p>` : ""}
    ${media ? `<p class="rubric-media">${media}</p>` : ""}
    <div class="rubric-actions"><button data-remind="${item.id}" type="button">Relancer</button><button class="open-sheet" data-open-task="${item.id}" type="button">Ouvrir fiche</button></div>
  </article>`;
}

function workflowStage(item) {
  if (isCompleted(item)) return "Terminé";
  if (isInitialStatus(item)) return "Attribué";
  return "En cours";
}

function renderActivity() {
  const events = state.activity.length ? state.activity : [{ time: "14:01", text: "Didier a créé Commande Azran" }, { time: "14:22", text: "Steven a vu Vérifier stock Azul" }];
  el.activity.innerHTML = events.map((event) => `<article class="activity-item"><span>${event.time}</span><p>${event.text}</p></article>`).join("");
}

function renderSearchResults(query) {
  const normalized = normalizeSearch(query);
  if (!normalized) {
    el.searchResults.hidden = true;
    el.searchResults.innerHTML = "";
    return;
  }
  const results = state.tasks.filter((item) => !isDeleted(item)).filter((item) => {
    const haystack = [item.title, item.notes, item.assignee, item.createdBy, item.client, item.status, item.priority, typeLabel(item), item.amount].join(" ");
    return normalizeSearch(haystack).includes(normalized);
  }).slice(0, 10);
  el.searchResults.innerHTML = results.map((item) => `<button class="search-result" data-open-task="${item.id}" type="button"><strong>${item.title}</strong><span>${typeLabel(item)} · ${item.assignee} · ${isDeleted(item) ? "Supprimée" : item.status}</span></button>`).join("") || `<span class="empty-state">Aucun résultat.</span>`;
  el.searchResults.hidden = false;
}

function normalizeSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function bindRendered() {
  // Dynamic controls are handled once through event delegation in bindGlobal.
}

function openCreator(assignee) {
  const defaults = defaultDeadline();
  el.taskDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">Nouvelle tâche</p><h2>Attribuer à ${assignee}</h2></div></header>
    <form class="task-form" id="taskForm">
      <label>Titre<input name="title" required placeholder="Préparer commande"></label>
      <label>Rubrique<select name="missionType" id="missionTypeSelect" required>${Object.entries(MISSION_TYPES).map(([key, type]) => `<option value="${key}">${type.label}</option>`).join("")}</select></label>
      <label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>🔥 Urgente</option></select></label>
      <label>Date limite<input name="dueDate" type="date" value="${defaults.date}" required></label>
      <label>Heure limite<input name="dueTime" type="time" value="${defaults.time}" required></label>
      <label>Quantité demandée<input name="requested" type="number" min="0" inputmode="numeric" placeholder="12"></label>
      <label>Disponible<input name="available" type="number" min="0" inputmode="numeric" placeholder="10"></label>
      <label class="quote-field" hidden>Client<input name="client" placeholder="Nom du client"></label>
      <label class="quote-field" hidden>Montant TTC<input name="amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label>
      <label class="quote-field" hidden>Date du devis<input name="quoteDate" type="date" value="${defaults.date}"></label>
      <label class="wide">Notes<textarea name="notes" placeholder="Ajouter une note"></textarea></label>
      <button class="primary-action visible" type="submit">Créer la tâche</button>
    </form>`;
  const typeSelect = document.querySelector("#missionTypeSelect");
  const toggleQuoteFields = () => document.querySelectorAll(".quote-field").forEach((field) => { field.hidden = typeSelect.value !== "devis"; });
  typeSelect.addEventListener("change", toggleQuoteFields);
  toggleQuoteFields();
  document.querySelector("#taskForm").addEventListener("submit", (event) => createTask(event, assignee));
  el.taskDialog.showModal();
}

function createTask(event, assignee) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const missionType = form.get("missionType");
  const item = { id: `task-${Date.now()}`, title: form.get("title"), missionType, assignee, createdBy: CURRENT_USER, priority: form.get("priority"), dueDate: form.get("dueDate"), dueTime: form.get("dueTime"), due: formatDeadline(form.get("dueDate"), form.get("dueTime")), notes: form.get("notes"), requested: Number(form.get("requested") || 0), available: Number(form.get("available") || 0), client: form.get("client") || "", amount: Number(form.get("amount") || 0), quoteDate: form.get("quoteDate") || "", status: statusesForType(missionType)[0], createdAt: Date.now(), seenBy: [], history: [`Créée par ${CURRENT_USER} — ${dateTimeNow()}`] };
  state.tasks.unshift(item);
  addActivity(`${CURRENT_USER} a créé ${item.title} pour ${assignee}`);
  if (missingQuantity(item)) addActivity(`⚠️ ${item.title} : manquant ${missingQuantity(item)}`);
  save(item); render(); el.taskDialog.close();
  const pushTitle = item.missionType === "livraison" ? "Nouvelle livraison" : item.priority.includes("Urgente") ? "🔥 Nouvelle tâche urgente" : "Nouvelle tâche Winess Hub";
  sendPush(assignee, pushTitle, `${CURRENT_USER} t’a assigné : ${item.title}`, `#task-${item.id}`, `task:${item.id}:assigned`);
}

function openTask(id) {
  let item = state.tasks.find((task) => task.id === id);
  if (!item) return;
  openedTaskId = id;
  if (!item.seenBy.some((seen) => seen.user === CURRENT_USER)) {
    item.seenBy.push({ user: CURRENT_USER, date: dateNow(), time: timeNow() });
    item.history.push(`👁 Vu par ${CURRENT_USER} — ${dateTimeNow()}`);
    addActivity(`${CURRENT_USER} a vu ${item.title}`);
    sendPush(item.createdBy, "Tâche vue", `${CURRENT_USER} a vu : ${item.title}`, `#task-${item.id}`, `task:${item.id}:seen:${memberIdForName(CURRENT_USER)}`);
    save(item); render();
    item = state.tasks.find((task) => task.id === id);
  }
  el.taskDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">${typeLabel(item)}</p><h2>${item.title}</h2><p class="assignment-line">Assigné à ${item.assignee} par ${item.createdBy} <button class="whatsapp-share" id="shareTask" type="button">WhatsApp</button></p></div></header>
    <section class="task-detail-grid"><article><span>Statut</span><strong>${isDeleted(item) ? "Supprimée" : item.status}</strong></article><article><span>Priorité</span><strong>${item.priority}</strong></article><article><span>Date limite</span><strong>${formatDue(item)}</strong></article><article><span>Créée</span><strong>${new Date(item.createdAt).toLocaleString("fr-FR")}</strong></article></section>
    ${item.missionType === "devis" ? `<section class="quantity-status"><article><span>Client</span><strong>${item.client || "À préciser"}</strong></article><article><span>Montant</span><strong>${formatAmount(item.amount)}</strong></article><article><span>Date du devis</span><strong>${formatDate(item.quoteDate)}</strong></article></section>` : ""}
    ${item.requested || item.available ? `<section class="quantity-status"><article><span>Demandé</span><strong>${item.requested || 0}</strong></article><article><span>Disponible</span><strong>${item.available || 0}</strong></article><article class="${missingQuantity(item) ? "has-missing" : ""}"><span>Manquant</span><strong>${missingQuantity(item)}</strong></article></section>` : ""}
    ${missingQuantity(item) ? `<section class="missing-banner">⚠️ Produit manquant : ${missingQuantity(item)}</section>` : ""}
    <section class="read-status"><h3>Vu par</h3>${item.seenBy.map((seen) => `<p>👁 Vu par ${seen.user} — ${seen.date || dateNow()} ${seen.time}</p>`).join("") || `<p>Pas encore vue</p>`}</section>
    <section class="task-form single"><label>Notes<textarea id="taskNotes" ${isDeleted(item) ? "disabled" : ""}>${item.notes || ""}</textarea></label><div class="quantity-edit"><label>Date limite<input id="taskDueDate" type="date" value="${item.dueDate || ""}" ${isDeleted(item) ? "disabled" : ""}></label><label>Heure limite<input id="taskDueTime" type="time" value="${item.dueTime || ""}" ${isDeleted(item) ? "disabled" : ""}></label></div><div class="quantity-edit"><label>Demandé<input id="taskRequested" type="number" min="0" value="${item.requested || 0}" ${isDeleted(item) ? "disabled" : ""}></label><label>Disponible<input id="taskAvailable" type="number" min="0" value="${item.available || 0}" ${isDeleted(item) ? "disabled" : ""}></label></div>${item.missionType === "devis" ? `<div class="quantity-edit"><label>Client<input id="taskClient" value="${item.client || ""}"></label><label>Montant<input id="taskAmount" type="number" min="0" step="0.01" value="${item.amount || 0}"></label></div><label>Date du devis<input id="taskQuoteDate" type="date" value="${item.quoteDate || ""}"></label>` : ""}<label>Statut<select id="taskStatus" ${isDeleted(item) ? "disabled" : ""}>${statusesFor(item).map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></label></section>
    <div class="task-form-actions">${isDeleted(item) ? "" : `<button id="saveTask" type="button">Valider</button>${isCompleted(item) ? "" : `<button id="remindTask" type="button">Relancer</button>`}<button id="deleteTask" class="danger-action" type="button">Supprimer</button>`}<button id="shareTaskBottom" class="whatsapp-action" type="button">Partager WhatsApp</button></div>
    <details class="task-history"><summary>Historique</summary>${item.history.map((line) => `<p>${line}</p>`).join("")}</details>`;
  document.querySelector("#saveTask")?.addEventListener("click", () => saveTaskDetails(item));
  document.querySelector("#shareTask").addEventListener("click", () => shareTask(item));
  document.querySelector("#shareTaskBottom").addEventListener("click", () => shareTask(item));
  document.querySelector("#remindTask")?.addEventListener("click", () => remindTask(item.id));
  document.querySelector("#deleteTask")?.addEventListener("click", () => deleteTask(item));
  el.taskDialog.showModal();
}

function saveTaskDetails(item) {
  const previousStatus = item.status;
  const previousMissing = missingQuantity(item);
  item.notes = document.querySelector("#taskNotes").value;
  const dueDate = document.querySelector("#taskDueDate").value;
  const dueTime = document.querySelector("#taskDueTime").value;
  if (dueDate) {
    item.dueDate = dueDate;
    item.dueTime = dueTime;
    item.due = formatDeadline(dueDate, dueTime);
  }
  item.requested = Number(document.querySelector("#taskRequested").value || 0);
  item.available = Number(document.querySelector("#taskAvailable").value || 0);
  if (item.missionType === "devis") {
    item.client = document.querySelector("#taskClient").value;
    item.amount = Number(document.querySelector("#taskAmount").value || 0);
    item.quoteDate = document.querySelector("#taskQuoteDate").value;
  }
  item.status = document.querySelector("#taskStatus").value;
  item.history.push(`Modifiée par ${CURRENT_USER} — ${dateTimeNow()}`);

  if (item.status !== previousStatus) recordStatusActivity(item, item.status);
  if (missingQuantity(item) && missingQuantity(item) !== previousMissing) {
    item.history.push(`⚠️ Manquant signalé : ${missingQuantity(item)} — ${dateTimeNow()}`);
    addActivity(`${CURRENT_USER} a signalé un manquant de ${missingQuantity(item)} sur ${item.title}`);
    sendPush(item.createdBy, "Produit manquant", `${item.title} : manquant ${missingQuantity(item)}`, `#task-${item.id}`, `task:${item.id}:missing:${missingQuantity(item)}`);
  }
  save(item); render(); el.taskDialog.close();
  showToast(isCompleted(item) ? "Tâche déplacée dans les archives" : "Modifications enregistrées");
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
  const eventId = `task:${item.id}:status:${status}`;
  if (["En cours", "Pris en charge", "En livraison"].includes(status)) sendPush(item.createdBy, "Tâche prise en charge", `${CURRENT_USER} s’occupe de : ${item.title}`, `#task-${item.id}`, eventId);
  if (status === "Prête") sendPush(item.createdBy, "Commande prête", `${item.title} est prête`, `#task-${item.id}`, eventId);
  if (status === "Récupérée") sendPush(item.createdBy, "Commande récupérée", `${item.title} a été récupérée`, `#task-${item.id}`, eventId);
  if (status === "Prêt départ") sendPush(item.createdBy, "Livraison prête", `${item.title} est prête au départ`, `#task-${item.id}`, eventId);
  if (status === "Livré") sendPush(item.createdBy, "Livraison livrée", `${item.title} a été livrée`, `#task-${item.id}`, eventId);
  if (isCompleted(item) && !["Récupérée", "Livré"].includes(status)) sendPush(item.createdBy, "Tâche terminée", `${item.title} : ${status}`, `#task-${item.id}`, eventId);
}

function shareTask(item) {
  const url = `https://steven77726.github.io/WINESS-HUB/?v=290#task-${item.id}`;
  const text = `Mission : ${item.title}\nAssigné à : ${item.assignee}\nAssigné par : ${item.createdBy}\nStatut : ${item.status}\nPriorité : ${item.priority}\nDate limite : ${formatDue(item)}\nNotes : ${item.notes || "Aucune"}\nLien : ${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const opened = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  if (!opened) location.href = whatsappUrl;
}

function updateStatus(value) {
  const [id, status] = value.split(":");
  const item = state.tasks.find((task) => task.id === id);
  if (!item) return;
  item.status = status;
  recordStatusActivity(item, status);
  save(item); render();
  showToast(isCompleted(item) ? "Tâche déplacée dans les archives" : `Statut : ${status}`);
}

async function remindTask(id) {
  const item = state.tasks.find((task) => task.id === id);
  if (!item || isArchived(item)) return;
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const historyLine = `Relance envoyée par ${CURRENT_USER} — ${dateTimeNow()}`;
  item.history.push(historyLine);
  addActivity(`${CURRENT_USER} a relancé ${item.assignee} pour ${item.title}`);
  save(item); render();
  if (el.taskDialog.open) document.querySelector(".task-history")?.insertAdjacentHTML("beforeend", `<p>${historyLine}</p>`);
  const pushed = await sendPush(item.assignee, "Tâche relancée", `${CURRENT_USER} te relance : ${item.title}`, `#task-${item.id}`, `task:${item.id}:remind:${bucket}`);
  showToast(pushed ? `Relance envoyée à ${item.assignee}` : `Relance enregistrée pour ${item.assignee}`);
}

function deleteTask(item) {
  if (!confirm(`Supprimer « ${item.title} » ? Cette action la retirera de l’application.`)) return;
  item.deletedAt = new Date().toISOString();
  item.deletedBy = CURRENT_USER;
  item.history.push(`Supprimée par ${CURRENT_USER} — ${dateTimeNow()}`);
  addActivity(`${CURRENT_USER} a supprimé ${item.title}`);
  save(item);
  render();
  el.taskDialog.close();
  showToast("Fiche supprimée");
}

function openMember(id) {
  const member = members.find((item) => item.id === id);
  if (!member) return;
  const tasks = state.tasks.filter((item) => item.assignee === member.name && !isDeleted(item));
  el.memberDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">Profil</p><h2>${member.name}</h2><p>${member.role}</p></div></header><section class="task-list"><h3>En cours</h3>${tasks.filter((item) => !isCompleted(item)).map(toolTask).join("") || `<p>Aucune tâche.</p>`}</section><details class="profile-done"><summary>Terminées</summary>${tasks.filter(isCompleted).map(archiveTask).join("") || `<p>Aucune tâche terminée.</p>`}</details>`;
  el.memberDialog.showModal();
}

function bindGlobal() {
  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open-task]");
    if (open) { event.stopPropagation(); el.searchResults.hidden = true; openTask(open.dataset.openTask); return; }
    const add = event.target.closest("[data-add-task]");
    if (add) { event.stopPropagation(); openCreator(add.dataset.addTask); return; }
    const avatar = event.target.closest("[data-avatar]");
    if (avatar) { event.stopPropagation(); selectedAvatar = avatar.dataset.avatar; el.avatarUpload.click(); return; }
    const status = event.target.closest("[data-status]");
    if (status) { event.stopPropagation(); updateStatus(status.dataset.status); return; }
    const reminder = event.target.closest("[data-remind]");
    if (reminder) { event.stopPropagation(); remindTask(reminder.dataset.remind); return; }
    const member = event.target.closest("[data-member]");
    if (member) openMember(member.dataset.member);
  });
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close()));
  document.querySelector("#sidebarToggle").addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));
  document.querySelector("#enablePushButton").addEventListener("click", enablePush);
  el.pushProfile.value = CURRENT_USER;
  el.pushProfile.addEventListener("change", () => {
    CURRENT_USER = el.pushProfile.value;
    localStorage.setItem("winess-hub:current-user", CURRENT_USER);
    el.pushState.textContent = "Notifications non activées pour ce profil";
    render();
  });
  el.avatarUpload.addEventListener("change", updateAvatar);
  el.globalSearch.addEventListener("input", () => renderSearchResults(el.globalSearch.value));
  el.globalSearch.addEventListener("keydown", (event) => { if (event.key === "Escape") { el.globalSearch.value = ""; renderSearchResults(""); } });
  window.addEventListener("hashchange", handleHash);
  if (matchMedia("(max-width: 900px)").matches) document.body.classList.add("sidebar-collapsed");
}

function showView(name) {
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === name));
  const rubricKey = name.startsWith("rubrique-") ? name.replace("rubrique-", "") : "";
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("is-active", rubricKey ? panel.dataset.panel === "rubrique" : panel.dataset.panel === name));
  if (rubricKey) renderRubric(rubricKey);
  location.hash = `view-${name}`;
}

function handleHash() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("task-")) return openTask(hash.slice(5));
  if (hash.startsWith("view-")) return showView(hash.slice(5));
  showView("accueil");
}

async function updateAvatar(event) {
  const file = event.target.files?.[0];
  if (!file || !selectedAvatar) return;
  if (supabaseClient) {
    try {
      const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const path = `${selectedAvatar}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabaseClient.storage.from("avatars").upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabaseClient.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: profileError } = await supabaseClient.from("hub_profiles").upsert({ id: selectedAvatar, avatar_url: avatarUrl, updated_by: memberIdForName(CURRENT_USER) });
      if (profileError) throw profileError;
      state.avatars[selectedAvatar] = avatarUrl;
      broadcastChange("profile_changed", { profile: { id: selectedAvatar, avatar_url: avatarUrl } });
      save(); render(); showToast("Photo de profil synchronisée");
      event.target.value = "";
      return;
    } catch (error) {
      console.error("Upload avatar impossible", error);
      showToast("Photo conservée sur cet appareil uniquement");
    }
  }
  const reader = new FileReader();
  reader.onload = () => { state.avatars[selectedAvatar] = reader.result; save(); render(); };
  reader.readAsDataURL(file);
}

async function enablePush() {
  el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Pour recevoir les notifications iPhone, ouvrez Winess Hub dans Safari, cliquez sur Partager, puis Ajouter à l’écran d’accueil.</span>`;
  el.iphoneHelp.classList.add("is-visible");
  if (!matchMedia("(display-mode: standalone)").matches && navigator.standalone !== true) {
    el.pushState.textContent = "Ajoutez d’abord Winess Hub à l’écran d’accueil";
    return;
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    el.pushState.textContent = "Notifications non supportées sur ce navigateur";
    return;
  }
  if (VAPID_PUBLIC_KEY.includes("REMPLACE_MOI") || !supabaseClient) {
    el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Le site est prêt. Il reste à renseigner l’URL du backend et la clé VAPID publique.</span>`;
    el.pushState.textContent = "Configuration serveur nécessaire";
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    el.pushState.textContent = "Permission refusée";
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(VAPID_PUBLIC_KEY) });
  const { error } = await supabaseClient.functions.invoke("push", { body: { action: "subscribe", user_id: memberIdForName(CURRENT_USER), subscription } });
  if (error) throw new Error("Impossible d’enregistrer l’abonnement push");
  el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Notifications activées.</span>`;
  el.pushState.textContent = `Notifications activées pour ${CURRENT_USER}`;
}

async function sendPush(userName, title, body, url, eventId = "") {
  if (!supabaseClient) return false;
  const user = members.find((member) => member.name === userName);
  if (!user) return false;
  try {
    const notificationUrl = url?.startsWith("#") ? `./index.html${url}` : url;
    const { error } = await supabaseClient.functions.invoke("push", { body: { action: "notify", user_id: user.id, title, body, url: notificationUrl, event_id: eventId } });
    return !error;
  } catch {
    return false;
  }
}

function memberIdForName(name) {
  return members.find((member) => member.name === name)?.id || name.toLowerCase();
}

function base64ToBytes(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function addActivity(text) {
  const event = { id: crypto.randomUUID?.() || `activity-${Date.now()}-${Math.random()}`, time: timeNow(), text, createdAt: Date.now() };
  state.activity.unshift(event);
  syncActivity(event);
}
function timeNow() { return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date()); }
function dateNow() { return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()); }
function dateTimeNow() { return `${dateNow()} ${timeNow()}`; }
function registerServiceWorker() { if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {})); }

function defaultDeadline() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

function formatDeadline(date, time) {
  if (!date) return "À planifier";
  const value = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(value.getTime())) return "À planifier";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: time ? "2-digit" : undefined, minute: time ? "2-digit" : undefined }).format(value);
}

function formatDue(item) {
  return item.dueDate ? formatDeadline(item.dueDate, item.dueTime) : item.due || "À planifier";
}

function formatDate(value) {
  if (!value) return "À préciser";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fr-FR").format(date);
}

function formatAmount(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function showToast(message) {
  if (!el.toast) return;
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => el.toast.classList.remove("is-visible"), 2600);
}

async function initializeSupabase() {
  try {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const [{ data: remoteTasks, error: taskError }, { data: remoteActivity, error: activityError }, { data: remoteProfiles, error: profileError }] = await Promise.all([
      supabaseClient.from("hub_tasks").select("id,data,updated_at").order("updated_at", { ascending: false }),
      supabaseClient.from("hub_activity").select("id,event_time,text,created_at").order("created_at", { ascending: false }).limit(100),
      supabaseClient.from("hub_profiles").select("id,avatar_url,updated_at")
    ]);
    if (taskError || activityError) throw taskError || activityError;

    if (remoteTasks.length) {
      state.tasks = remoteTasks.map((row) => migrateTask({ ...row.data, id: row.id }));
    } else {
      const { error } = await supabaseClient.from("hub_tasks").upsert(state.tasks.map(taskRow));
      if (error) throw error;
    }
    if (remoteActivity.length) {
      state.activity = remoteActivity.map((row) => ({ id: row.id, time: row.event_time, text: row.text, createdAt: new Date(row.created_at).getTime() }));
    }
    (remoteProfiles || []).forEach((profile) => { if (profile.avatar_url) state.avatars[profile.id] = profile.avatar_url; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
    setSyncState("Synchronisé", true);

    realtimeChannel = supabaseClient.channel("winess-hub-live", { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "task_changed" }, applyBroadcastTask)
      .on("broadcast", { event: "activity_added" }, applyBroadcastActivity)
      .on("broadcast", { event: "profile_changed" }, applyBroadcastProfile)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_tasks" }, applyRemoteTask)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_activity" }, applyRemoteActivity);
    if (!profileError) realtimeChannel.on("postgres_changes", { event: "*", schema: "public", table: "hub_profiles" }, applyRemoteProfile);
    realtimeChannel.subscribe((status) => setSyncState(status === "SUBSCRIBED" ? "Temps réel" : "Connexion...", status === "SUBSCRIBED"));
  } catch (error) {
    console.warn("Supabase indisponible, stockage local conservé.", error);
    setSyncState("Mode local", false);
  }
}

function taskRow(item) {
  return { id: item.id, data: item, updated_by: memberIdForName(CURRENT_USER) };
}

async function syncTask(item) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from("hub_tasks").upsert(taskRow(item));
  if (error) setSyncState("Hors ligne", false);
  else broadcastChange("task_changed", { task: item });
}

async function syncActivity(event) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from("hub_activity").upsert({ id: event.id, event_time: event.time, text: event.text, created_by: memberIdForName(CURRENT_USER) });
  if (error) setSyncState("Hors ligne", false);
  else broadcastChange("activity_added", { activity: event });
}

function broadcastChange(event, payload) {
  if (!realtimeChannel) return;
  realtimeChannel.send({ type: "broadcast", event, payload: { ...payload, source: CLIENT_ID } });
}

function applyBroadcastTask({ payload }) {
  if (!payload?.task || payload.source === CLIENT_ID) return;
  applyRemoteTask({ eventType: "UPDATE", new: { id: payload.task.id, data: payload.task }, old: {} });
}

function applyBroadcastActivity({ payload }) {
  if (!payload?.activity || payload.source === CLIENT_ID) return;
  applyRemoteActivity({ new: { id: payload.activity.id, event_time: payload.activity.time, text: payload.activity.text, created_at: new Date(payload.activity.createdAt || Date.now()).toISOString() } });
}

function applyBroadcastProfile({ payload }) {
  if (!payload?.profile || payload.source === CLIENT_ID) return;
  applyRemoteProfile({ new: payload.profile });
}

function applyRemoteTask(payload) {
  const id = payload.old?.id || payload.new?.id;
  if (!id) return;
  const index = state.tasks.findIndex((item) => item.id === id);
  if (payload.eventType === "DELETE") {
    if (index >= 0) state.tasks.splice(index, 1);
  } else {
    const item = migrateTask({ ...payload.new.data, id });
    if (index >= 0) state.tasks[index] = item;
    else state.tasks.unshift(item);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  if (el.taskDialog.open && openedTaskId === id) {
    el.taskDialog.close();
    openTask(id);
    showToast("Fiche mise à jour en temps réel");
  }
}

function applyRemoteActivity(payload) {
  const row = payload.new;
  if (!row?.id || state.activity.some((event) => event.id === row.id)) return;
  state.activity.unshift({ id: row.id, time: row.event_time, text: row.text, createdAt: new Date(row.created_at).getTime() });
  state.activity = state.activity.slice(0, 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderActivity();
}

function applyRemoteProfile(payload) {
  const row = payload.new;
  if (!row?.id) return;
  if (row.avatar_url) state.avatars[row.id] = row.avatar_url;
  else delete state.avatars[row.id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function setSyncState(label, online) {
  if (!el.syncState) return;
  el.syncState.textContent = label;
  el.syncState.classList.toggle("is-online", online);
}
