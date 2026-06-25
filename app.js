import { finalStatusKind, isCompletedStatus, normalizedStatusKey } from "./task-status.js";

const STORAGE_KEY = "winess-hub:v260";
const DEVICE_PROFILE_KEY = "winess-hub:device-profile:v1";
const DEVICE_ID_KEY = "winess-hub:device-id";
const PROFILE_VALIDITY = 30 * 24 * 60 * 60 * 1000;
const deviceSession = readDeviceSession();
let CURRENT_USER = deviceSession?.name || "";
const TWO_HOURS = 2 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const SUPABASE_URL = "https://xzcshuoelidzdlihnwme.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KI7h19VdLtB2YfXBsN4bAw_9KQMxNBs";
const APP_BASE_URL = "https://steven77726.github.io/WINESS-HUB/";
const APP_VERSION = "303";
const IS_FILE_MODE = location.protocol === "file:";
let supabaseClient = null;
let realtimeChannel = null;
const CLIENT_ID = crypto.randomUUID?.() || `client-${Date.now()}-${Math.random()}`;
const DEVICE_ID = getDeviceId();
const EDGE_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;
const VAPID_PUBLIC_KEY = "BDEUT7mYiel6Ns3NpHSHgegKWk7jGK43pGrM9zR_MRl_A4zbfYD9oLQbSHscM8_OVkHTkjrBVW2-m0RTBrWqrAw";

const MISSION_TYPES = {
  preparation: { label: "📦 Préparation commande", statuses: ["Attribué", "En cours", "Prête", "Prête avec manquants", "Récupérée", "Terminée"] },
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
let homeExpiryTimer = 0;
let activeSearchFilter = "all";
let searchInputTimer = 0;

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
  pushProfileName: document.querySelector("#pushProfileName"),
  pushState: document.querySelector("#pushState"),
  rubricTitle: document.querySelector("#rubricTitle"),
  rubricSummary: document.querySelector("#rubricSummary"),
  rubricList: document.querySelector("#rubricList"),
  syncState: document.querySelector("#syncState"),
  globalSearch: document.querySelector("#globalSearch"),
  searchFilters: document.querySelector("#searchFilters"),
  searchResults: document.querySelector("#searchResults"),
  toast: document.querySelector("#appToast"),
  profileGate: document.querySelector("#profileGate"),
  profileGateContent: document.querySelector("#profileGateContent"),
  activeProfileName: document.querySelector("#activeProfileName"),
  activeProfileRole: document.querySelector("#activeProfileRole"),
  activeProfileAvatar: document.querySelector("#activeProfileAvatar")
};

if (IS_FILE_MODE) {
  showHostedAppRedirect();
} else {
  save();
  render();
  bindGlobal();
  handleHash();
  registerServiceWorker();
  initializeSupabase().finally(initializeIdentity);
}

function showHostedAppRedirect() {
  const target = `${APP_BASE_URL}index.html?v=${APP_VERSION}${location.hash || "#view-accueil"}`;
  document.body.innerHTML = `<main class="file-mode-redirect">
    <section>
      <span class="brand-mark">W</span>
      <h1>Ouverture de Winess Hub</h1>
      <p>L’app doit être ouverte depuis l’adresse en ligne pour se connecter à Supabase, synchroniser les tâches et activer les notifications.</p>
      <a href="${target}">Ouvrir la version connectée</a>
    </section>
  </main>`;
  window.setTimeout(() => location.replace(target), 900);
}

function readDeviceSession() {
  try {
    const session = JSON.parse(localStorage.getItem(DEVICE_PROFILE_KEY) || "null");
    if (!session?.name || !session?.validatedAt || Date.now() - session.validatedAt > PROFILE_VALIDITY) return null;
    return session;
  } catch {
    return null;
  }
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function initializeIdentity() {
  const session = readDeviceSession();
  const member = members.find((item) => item.name === session?.name && item.id === session?.userId);
  if (!member) {
    CURRENT_USER = "";
    localStorage.removeItem(DEVICE_PROFILE_KEY);
    renderIdentity();
    showProfileChooser();
    return;
  }
  CURRENT_USER = member.name;
  renderIdentity();
  render();
}

function renderIdentity() {
  const member = members.find((item) => item.name === CURRENT_USER);
  el.activeProfileName.textContent = member?.name || "Profil requis";
  el.activeProfileRole.textContent = member?.role || "Cet appareil";
  el.pushProfileName.textContent = member?.name || "Non identifié";
  const avatar = member && state.avatars[member.id];
  el.activeProfileAvatar.innerHTML = avatar ? `<img src="${avatar}" alt="">` : member?.name[0] || "?";
}

function showProfileChooser() {
  el.profileGateContent.innerHTML = `<header><p class="eyebrow">Winess Hub</p><h1>Qui utilise cet appareil ?</h1></header>
    <div class="profile-choice-grid">${members.map((member) => `<button data-choose-profile="${member.id}" type="button"><span>${member.name[0]}</span><strong>${member.name}</strong><small>${member.role}</small></button>`).join("")}</div>`;
  el.profileGateContent.querySelectorAll("[data-choose-profile]").forEach((button) => button.addEventListener("click", () => showPinStep(button.dataset.chooseProfile)));
  if (!el.profileGate.open) el.profileGate.showModal();
}

async function showPinStep(memberId) {
  const member = members.find((item) => item.id === memberId);
  if (!member) return;
  el.profileGateContent.innerHTML = `<div class="profile-gate-loading">Vérification du profil...</div>`;
  try {
    const response = await callEdgeFunction("profile-pin", { action: "status", user_id: member.id });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Profil indisponible");
    renderPinForm(member, result.has_pin ? "verify" : "register");
  } catch (error) {
    el.profileGateContent.innerHTML = `<header><h1>Connexion impossible</h1><p>${escapeHtml(error.message)}</p></header><button class="gate-secondary" id="retryProfiles" type="button">Réessayer</button>`;
    document.querySelector("#retryProfiles").addEventListener("click", showProfileChooser);
  }
}

function renderPinForm(member, mode) {
  const creating = mode === "register";
  el.profileGateContent.innerHTML = `<button class="gate-back" id="backToProfiles" type="button" aria-label="Retour">‹</button>
    <header><p class="eyebrow">${member.role}</p><h1>${member.name}</h1><p>${creating ? "Créez votre PIN personnel" : "Saisissez votre PIN personnel"}</p></header>
    <form class="pin-form" id="pinForm">
      <label>PIN à 4 chiffres<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="one-time-code" required autofocus></label>
      ${creating ? `<label>Confirmer le PIN<input name="confirmPin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required></label>` : ""}
      <p class="pin-error" id="pinError" aria-live="polite"></p>
      <button class="gate-primary" type="submit">${creating ? "Créer mon PIN" : "Continuer"}</button>
    </form>`;
  document.querySelector("#backToProfiles").addEventListener("click", showProfileChooser);
  document.querySelector("#pinForm").addEventListener("submit", (event) => submitPin(event, member, mode));
}

async function submitPin(event, member, mode) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const pin = String(form.get("pin") || "");
  const errorNode = document.querySelector("#pinError");
  if (!/^\d{4}$/.test(pin)) {
    errorNode.textContent = "Le PIN doit contenir exactement 4 chiffres.";
    return;
  }
  if (mode === "register" && pin !== form.get("confirmPin")) {
    errorNode.textContent = "Les deux PIN ne correspondent pas.";
    return;
  }
  const submit = event.currentTarget.querySelector("button[type=submit]");
  submit.disabled = true;
  submit.textContent = "Vérification...";
  try {
    const response = await callEdgeFunction("profile-pin", { action: mode, user_id: member.id, pin, device_id: DEVICE_ID });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "PIN incorrect");
    activateProfile(member);
  } catch (error) {
    errorNode.textContent = error.message;
    submit.disabled = false;
    submit.textContent = mode === "register" ? "Créer mon PIN" : "Continuer";
  }
}

function activateProfile(member) {
  CURRENT_USER = member.name;
  localStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify({ userId: member.id, name: member.name, deviceId: DEVICE_ID, validatedAt: Date.now() }));
  localStorage.removeItem("winess-hub:current-user");
  el.profileGate.close();
  renderIdentity();
  render();
  addActivity(`${member.name} a validé son profil sur cet appareil`);
  showToast(`Profil ${member.name} actif`);
}

function changeProfile() {
  if (CURRENT_USER && !confirm(`Changer le profil ${CURRENT_USER} sur cet appareil ?`)) return;
  const previous = CURRENT_USER;
  if (previous) addActivity(`${previous} a demandé un changement de profil`);
  localStorage.removeItem(DEVICE_PROFILE_KEY);
  CURRENT_USER = "";
  renderIdentity();
  render();
  showProfileChooser();
}

function task(id, title, missionType, assignee, createdBy, priority, due, notes, minutesAgo, status, requested = 0, available = 0) {
  const products = missionType === "preparation" && requested ? [{ id: `product-${id}`, name: title.replace(/^Préparer\s*/i, ""), requested, available, prepared: false }] : [];
  return { id, title, missionType, assignee, createdBy, assignedTo: assignee, assignedBy: createdBy, priority, due, notes, status: status || statusesForType(missionType)[0], requested, available, products, reminderMode: "none", reminderEnabled: false, lastReminderAt: null, createdAt: Date.now() - minutesAgo * 60000, seenBy: [], history: [`Créée par ${createdBy} — ${dateTimeNow()}`] };
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

function migrateTask(item, databaseUpdatedAt = null) {
  const missionType = item.missionType || legacyMissionType(item.category);
  const statuses = statusesForType(missionType);
  let status = item.status;
  if (!statuses.includes(status) && !isCompletedStatus(status)) {
    if (["Nouvelle", "Vue", "Attribué"].includes(status)) status = statuses[0];
    else if (["Prise en charge", "Pris en charge", "En cours"].includes(status)) status = statuses.includes("En cours") ? "En cours" : statuses.includes("Pris en charge") ? "Pris en charge" : statuses[1];
    else if (["Terminée", "Terminé"].includes(status)) status = statuses[statuses.length - 1];
    else status = statuses[0];
  }
  const assignee = item.assignedTo || item.assignee || "Non assigné";
  const createdBy = item.assignedBy || item.createdBy || "Inconnu";
  const reminderMode = ["1h", "2h", "4h", "daily"].includes(item.reminderMode) ? item.reminderMode : "none";
  const completedAt = item.completedAt || (isCompletedStatus(status) ? databaseUpdatedAt || item.updatedAt || new Date(item.createdAt || Date.now()).toISOString() : null);
  return { ...item, missionType, status, assignee, createdBy, assignedTo: assignee, assignedBy: createdBy, completedAt, reminderMode, reminderEnabled: reminderMode !== "none" && item.reminderEnabled !== false && !isCompletedStatus(status), lastReminderAt: item.lastReminderAt || null, seenBy: item.seenBy || [], history: item.history || [], products: normalizeProducts(item), requested: Number(item.requested || 0), available: Number(item.available || 0), amount: Number(item.amount || 0) };
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
  renderIdentity();
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
  scheduleHomeExpiry();
  bindRendered();
}

function scheduleHomeExpiry() {
  clearTimeout(homeExpiryTimer);
  const remaining = state.tasks
    .filter(isRecentlyCompleted)
    .map((item) => SEVEN_DAYS - (Date.now() - new Date(item.completedAt).getTime()))
    .filter((delay) => delay > 0);
  if (!remaining.length) return;
  homeExpiryTimer = window.setTimeout(render, Math.min(...remaining) + 1000);
}

function activeTasksFor(name) {
  return state.tasks.filter((item) => item.assignee === name && !isArchived(item));
}

function homeTasksFor(name) {
  return state.tasks
    .filter((item) => item.assignee === name && !isDeleted(item))
    .filter((item) => {
      if (["done", "archived"].includes(activeSearchFilter)) return isCompleted(item);
      if (["livraison", "commandes", "inventaire", "litige"].includes(activeSearchFilter)) return true;
      return !isCompleted(item) || isRecentlyCompleted(item);
    })
    .filter(matchesHomeFilter)
    .sort(compareHomeTasks);
}

function matchesHomeFilter(item) {
  if (activeSearchFilter === "all") return true;
  return matchesSearchFilter(item);
}

function homeEmptyLabel() {
  const labels = {
    all: "Aucune tâche active",
    active: "Aucune tâche en cours",
    done: "Aucune tâche terminée",
    archived: "Aucune archive",
    urgent: "Aucune urgence",
    livraison: "Aucune livraison",
    commandes: "Aucune commande",
    inventaire: "Aucun inventaire",
    litige: "Aucun litige"
  };
  return labels[activeSearchFilter] || "Aucune tâche";
}

function isRecentlyCompleted(item) {
  if (!isCompleted(item)) return false;
  const completedAt = new Date(item.completedAt || 0).getTime();
  return completedAt > 0 && Date.now() - completedAt <= SEVEN_DAYS;
}

function compareHomeTasks(left, right) {
  const rankDifference = homeTaskRank(left) - homeTaskRank(right);
  if (rankDifference) return rankDifference;
  const leftTime = isCompleted(left) ? new Date(left.completedAt || 0).getTime() : Number(left.createdAt || 0);
  const rightTime = isCompleted(right) ? new Date(right.completedAt || 0).getTime() : Number(right.createdAt || 0);
  return rightTime - leftTime;
}

function homeTaskRank(item) {
  if (!isCompleted(item) && item.priority?.includes("Urgente")) return 0;
  if (!isCompleted(item) && isInitialStatus(item)) return 1;
  if (!isCompleted(item)) return 2;
  const finalKind = finalStatusKind(item.status);
  if (finalKind === "validated") return 3;
  if (finalKind === "recovered") return 4;
  if (finalKind === "delivered") return 5;
  return 6;
}

function isOverdue(item) {
  return isInitialStatus(item) && Date.now() - item.createdAt > TWO_HOURS;
}

function statusesForType(type) {
  return (MISSION_TYPES[type] || MISSION_TYPES.autre).statuses;
}

function statusesFor(item) {
  const statuses = [...statusesForType(item.missionType)];
  if (!statuses.includes("Validé")) statuses.push("Validé");
  return isCompletedStatus(item.status) && !statuses.includes(item.status) ? [...statuses, item.status] : statuses;
}

function isInitialStatus(item) {
  return item.status === statusesFor(item)[0];
}

function isCompleted(item) {
  return isCompletedStatus(item.status);
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

function completedStatusIcon(status) {
  const kind = finalStatusKind(status);
  if (kind === "recovered" || normalizedStatusKey(status) === "prete") return "📦";
  if (kind === "delivered") return "🚚";
  return "✅";
}

function missingQuantity(item) {
  if (item.products?.length) return item.products.reduce((total, product) => total + productMissing(product), 0);
  return Math.max(0, Number(item.requested || 0) - Number(item.available || 0));
}

function normalizeProducts(item) {
  const products = Array.isArray(item.products) ? item.products : [];
  if (products.length) return products.map((product, index) => ({
    id: product.id || `product-${item.id || Date.now()}-${index}`,
    name: String(product.name || product.product || "").trim(),
    requested: Number(product.requested || product.quantity || 0),
    available: Number(product.available || product.stock || 0),
    prepared: Boolean(product.prepared)
  }));
  if (item.missionType === "preparation" && (item.requested || item.available)) {
    return [{ id: `product-${item.id || Date.now()}-0`, name: item.title || "Produit", requested: Number(item.requested || 0), available: Number(item.available || 0), prepared: false }];
  }
  return [];
}

function productMissing(product) {
  return Math.max(0, Number(product.requested || 0) - Number(product.available || 0));
}

function productSummary(products = []) {
  const total = products.length;
  const availableCount = products.filter((product) => !productMissing(product)).length;
  const missingProducts = products.filter(productMissing);
  return { total, availableCount, missingCount: missingProducts.length, missingProducts };
}

function productStateLabel(product) {
  const missing = productMissing(product);
  return missing ? `⚠️ Manquant : ${missing}` : "✅ Disponible";
}

function preparationHomeStatus(item) {
  if (item.status === "Prête avec manquants") return "⚠️ Prête avec manquants";
  return `${completedStatusIcon(item.status)} ${item.status}`;
}

function renderUrgencies() {
  const urgent = state.tasks.filter((item) => item.priority.includes("Urgente") && !isArchived(item));
  el.urgent.innerHTML = urgent.slice(0, 4).map((item) => `<button class="urgency-item" data-open-task="${item.id}" type="button"><strong>🔥 ${item.title}</strong><span>${formatDue(item)} · ${item.assignee}</span></button>`).join("") || `<span class="empty-state">Aucune urgence active.</span>`;
}

function memberCard(member) {
  const activeTasks = activeTasksFor(member.name);
  const tasks = homeTasksFor(member.name);
  const avatar = state.avatars[member.id];
  return `<article class="employee-card ${member.group}" data-member="${member.id}">
    <div class="employee-top">
      <button class="photo" data-avatar="${member.id}" type="button" aria-label="Changer la photo de ${member.name}">
        ${avatar ? `<img src="${avatar}" alt="${member.name}">` : `<span>${member.name[0]}</span>`}
        ${activeTasks.length ? `<span class="task-badge">${activeTasks.length}</span>` : ""}
      </button>
      <button class="profile-plus" data-add-task="${member.name}" type="button">+</button>
    </div>
    <div class="employee-tags">
      ${tasks.slice(0, 3).map(taskChip).join("") || `<span class="empty-chip">${homeEmptyLabel()}</span>`}
      ${tasks.length > 3 ? `<button class="task-chip more-chip" data-member="${member.id}" type="button">+${tasks.length - 3} autres</button>` : ""}
    </div>
    <div class="employee-bottom"><div><h3>${member.name}</h3><p>${member.role}</p></div></div>
  </article>`;
}

function taskChip(item) {
  if (isCompleted(item)) {
    return `<button class="task-chip completed completed-${finalStatusKind(item.status) || "done"}" data-open-task="${item.id}" type="button"><span class="task-chip-title">${escapeHtml(item.title)}</span><span class="task-chip-status">${escapeHtml(item.missionType === "preparation" ? preparationHomeStatus(item) : `${completedStatusIcon(item.status)} ${item.status}`)}</span></button>`;
  }
  const prefix = isOverdue(item) ? "⏰ " : item.priority.includes("Urgente") ? "🔥 " : "";
  const urgent = isOverdue(item) || item.priority.includes("Urgente") ? " urgent" : "";
  return `<button class="task-chip${urgent}" data-open-task="${item.id}" type="button">${prefix}${escapeHtml(item.title)}</button>`;
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
    <div class="task-actions-row">${nextStatuses(item).map((status) => `<button data-status="${item.id}:${status}" type="button">${status}</button>`).join("")}${item.createdBy === CURRENT_USER ? `<button data-remind="${item.id}" type="button">Relancer</button>` : ""}</div>
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
  const tasks = state.tasks.filter((item) => item.missionType === key && !isDeleted(item));
  const activeTasks = tasks.filter((item) => !isCompleted(item)).sort((a, b) => b.createdAt - a.createdAt);
  const archivedTasks = tasks.filter(isCompleted).sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
  el.rubricTitle.textContent = type.label;
  el.rubricSummary.innerHTML = `<span>${activeTasks.length} en cours</span><span>${archivedTasks.length} archivée${archivedTasks.length > 1 ? "s" : ""}</span>`;
  el.rubricList.innerHTML = `<section class="rubric-section"><h3>En cours</h3>${activeTasks.map(rubricCard).join("") || `<p class="empty-state">Aucune tâche en cours.</p>`}</section><section class="rubric-section"><h3>Archivées</h3>${archivedTasks.map(rubricCard).join("") || `<p class="empty-state">Aucune tâche archivée.</p>`}</section>`;
}

function rubricCard(item) {
  const media = [item.photo ? "Photo" : "", item.voice ? "Vocal" : ""].filter(Boolean).join(" · ");
  return `<article class="rubric-card ${isCompleted(item) ? "is-done" : ""}">
    <header><div><strong>${item.title}</strong><p>Assigné à ${item.assignee} par ${item.createdBy}</p></div><span class="workflow-badge">${workflowStage(item)}</span></header>
    <div class="rubric-meta"><span>${item.status}</span><span>${item.priority}</span><span>${formatDue(item)}</span>${item.reminderEnabled ? `<span>Rappel ${reminderLabel(item.reminderMode)}</span>` : ""}</div>
    ${item.missionType === "devis" ? `<div class="quote-summary"><span>${item.client || "Client à préciser"}</span><strong>${formatAmount(item.amount)}</strong></div>` : ""}
    ${item.notes ? `<p class="rubric-notes">${item.notes}</p>` : ""}
    ${media ? `<p class="rubric-media">${media}</p>` : ""}
    <div class="rubric-actions">${!isCompleted(item) && item.createdBy === CURRENT_USER ? `<button data-remind="${item.id}" type="button">Relancer</button>` : ""}<button class="open-sheet" data-open-task="${item.id}" type="button">Ouvrir fiche</button></div>
  </article>`;
}

function workflowStage(item) {
  if (isCompleted(item)) return "Terminé";
  if (isInitialStatus(item)) return "Attribué";
  return "En cours";
}

function renderActivity() {
  el.activity.innerHTML = state.activity.map((event) => `<article class="activity-item"><span>${event.time}</span><p>${event.text}</p></article>`).join("") || `<p class="empty-state">Aucune activité enregistrée.</p>`;
}

function renderSearchResults(query) {
  const normalized = normalizeSearch(query);
  if (!normalized) {
    el.searchResults.hidden = true;
    el.searchResults.innerHTML = "";
    return;
  }
  const taskMatches = new Map();
  state.tasks.filter((item) => !isDeleted(item)).forEach((item) => {
    if (matchesSearch(item, normalized) && matchesSearchFilter(item)) taskMatches.set(item.id, item);
  });
  state.activity.forEach((event) => {
    if (!normalizeSearch([event.text, event.time].join(" ")).includes(normalized)) return;
    const linked = findTaskFromActivity(event.text);
    if (linked && matchesSearchFilter(linked)) taskMatches.set(linked.id, linked);
  });
  const taskResults = [...taskMatches.values()].sort(compareSearchTasks).slice(0, 14);
  const memberResults = members.filter((member) => {
    if (activeSearchFilter !== "all") return false;
    return normalizeSearch([member.name, member.role, member.id].join(" ")).includes(normalized);
  }).slice(0, 3);
  const activityResults = state.activity.filter((event) => {
    if (activeSearchFilter !== "all") return false;
    if (findTaskFromActivity(event.text)) return false;
    return normalizeSearch([event.text, event.time].join(" ")).includes(normalized);
  }).slice(0, 3);
  el.searchResults.innerHTML = [
    ...taskResults.map(searchTaskResult),
    ...memberResults.map(searchMemberResult),
    ...activityResults.map(searchActivityResult)
  ].join("") || `<span class="empty-state">Aucun résultat.</span>`;
  el.searchResults.hidden = false;
}

function matchesSearch(item, normalized) {
  return normalizeSearch(searchableTaskText(item)).includes(normalized);
}

function searchableTaskText(item) {
  return [
    item.title,
    item.description,
    item.notes,
    item.comments,
    item.commentaires,
    item.assignee,
    item.assignedTo,
    item.createdBy,
    item.assignedBy,
    item.client,
    item.customer,
    item.supplier,
    item.fournisseur,
    item.address,
    item.adresse,
    item.phone,
    item.telephone,
    item.orderRef,
    item.reference,
    item.status,
    item.priority,
    item.missionType,
    typeLabel(item),
    item.amount,
    (item.history || []).join(" "),
    state.activity.filter((event) => event.text?.includes(item.title)).map((event) => `${event.time} ${event.text}`).join(" ")
  ].filter(Boolean).join(" ");
}

function matchesSearchFilter(item) {
  if (activeSearchFilter === "active") return !isArchived(item);
  if (activeSearchFilter === "done") return isCompleted(item);
  if (activeSearchFilter === "archived") return isArchived(item);
  if (activeSearchFilter === "urgent") return item.priority?.includes("Urgente") && !isCompleted(item);
  if (activeSearchFilter === "livraison") return item.missionType === "livraison";
  if (activeSearchFilter === "commandes") return ["preparation", "fournisseur"].includes(item.missionType);
  if (activeSearchFilter === "inventaire") return item.missionType === "inventaire";
  if (activeSearchFilter === "litige") return item.missionType === "litige";
  return true;
}

function compareSearchTasks(left, right) {
  const rankDifference = searchTaskRank(left) - searchTaskRank(right);
  if (rankDifference) return rankDifference;
  const leftTime = new Date(left.completedAt || left.updatedAt || left.createdAt || 0).getTime();
  const rightTime = new Date(right.completedAt || right.updatedAt || right.createdAt || 0).getTime();
  return rightTime - leftTime;
}

function searchTaskRank(item) {
  if (!isCompleted(item) && item.priority?.includes("Urgente")) return 0;
  if (!isCompleted(item) && isInitialStatus(item)) return 1;
  if (!isCompleted(item)) return 2;
  const finalKind = finalStatusKind(item.status);
  if (!isRecentlyCompleted(item)) return 7;
  if (finalKind === "recovered") return 4;
  if (finalKind === "delivered") return 5;
  return 3;
}

function findTaskFromActivity(text) {
  const normalized = normalizeSearch(text);
  return state.tasks.find((item) => item.id && normalized.includes(normalizeSearch(item.id))) ||
    state.tasks.find((item) => item.title && normalized.includes(normalizeSearch(item.title)));
}

function searchTaskResult(item) {
  const done = isCompleted(item);
  const archiveLabel = isArchived(item) && !isRecentlyCompleted(item) ? " · Archives" : "";
  return `<button class="search-result ${done ? "is-done" : ""}" data-open-task="${item.id}" type="button">
    <strong>${done ? `<s>${escapeHtml(item.title)}</s>` : escapeHtml(item.title)}</strong>
    <span>Assigné à ${escapeHtml(item.assignee || "À préciser")} · par ${escapeHtml(item.createdBy || "À préciser")}</span>
    <small>${escapeHtml(typeLabel(item))} · Statut : ${escapeHtml(item.status || "Attribué")}${archiveLabel}</small>
  </button>`;
}

function searchMemberResult(member) {
  return `<button class="search-result search-person" data-member="${member.id}" type="button"><strong>👤 ${escapeHtml(member.name)}</strong><span>Collaborateur · ${escapeHtml(member.role)}</span><small>Ouvrir sa fiche et ses tâches</small></button>`;
}

function searchActivityResult(event) {
  return `<button class="search-result search-activity" data-open-view="activite" type="button"><strong>Activité</strong><span>${escapeHtml(event.time || "")}</span><small>${escapeHtml(event.text || "")}</small></button>`;
}

function normalizeSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function bindRendered() {
  // Dynamic controls are handled once through event delegation in bindGlobal.
}

function openCreator(assignee) {
  if (!requireIdentity()) return;
  const defaults = defaultDeadline();
  el.taskDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">Nouvelle tâche</p><h2>Attribuer à ${assignee}</h2></div></header>
    <form class="task-form creator-form" id="taskForm">
      <label class="wide mission-type-picker">📂 Type de mission<select name="missionType" id="missionTypeSelect" required><option value="">Choisir une rubrique</option>${missionTypeOptions()}</select></label>
      <section class="creator-specific" id="creatorSpecific" hidden></section>
    </form>`;
  const typeSelect = document.querySelector("#missionTypeSelect");
  typeSelect.addEventListener("change", () => renderCreatorSpecific(typeSelect.value, assignee, defaults));
  document.querySelector("#taskForm").addEventListener("submit", (event) => createTask(event, assignee));
  el.taskDialog.showModal();
}

function missionTypeOptions() {
  const order = ["preparation", "livraison", "inventaire", "blocage", "litige", "rappel", "fournisseur", "instagram", "autre"];
  return order.map((key) => `<option value="${key}">${MISSION_TYPES[key].label.replace(/^[^\s]+\s/, "")}</option>`).join("");
}

function renderCreatorSpecific(type, assignee, defaults) {
  const target = document.querySelector("#creatorSpecific");
  if (!type) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  target.hidden = false;
  if (type === "preparation") {
    target.innerHTML = preparationCreatorMarkup(assignee, defaults);
    bindProductCreator();
    return;
  }
  target.innerHTML = genericCreatorMarkup(assignee, defaults, type);
}

function preparationCreatorMarkup(assignee, defaults) {
  return `<label class="wide">📝 Titre<input name="title" required placeholder="Mr Benhamou 14h boutique"></label>
    <label>👤 Assigné à<select name="assignee">${members.map((member) => `<option ${member.name === assignee ? "selected" : ""}>${member.name}</option>`).join("")}</select></label>
    <label>🔥 Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>🔥 Urgente</option></select></label>
    <label>📅 Date limite<input name="dueDate" type="date" value="${defaults.date}" required></label>
    <label>Heure limite<input name="dueTime" type="time" value="${defaults.time}" required></label>
    <label class="wide">🔔 Rappel automatique<select name="reminderMode"><option value="none">Aucun</option><option value="1h">Toutes les heures</option><option value="2h">Toutes les 2 heures</option><option value="4h">Toutes les 4 heures</option></select></label>
    <section class="products-editor wide">
      <header><h3>Produits à préparer</h3></header>
      <div class="product-rows" id="productRows">${productRowMarkup()}</div>
      <button class="secondary-action" id="addProductRow" type="button">➕ Ajouter un produit</button>
      <div class="product-summary-box" id="productSummaryBox"></div>
    </section>
    <label class="wide">Instructions<textarea name="notes" placeholder="Préparer dans un carton. Le client passe à 14h. Prévoir facture."></textarea></label>
    <button class="primary-action visible wide" type="submit">Valider</button>`;
}

function genericCreatorMarkup(assignee, defaults, type) {
  return `<label class="wide">Titre<input name="title" required placeholder="${MISSION_TYPES[type]?.label || "Nouvelle mission"}"></label>
    <label>Assigné à<select name="assignee">${members.map((member) => `<option ${member.name === assignee ? "selected" : ""}>${member.name}</option>`).join("")}</select></label>
    <label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>🔥 Urgente</option></select></label>
    <label>Date limite<input name="dueDate" type="date" value="${defaults.date}" required></label>
    <label>Heure limite<input name="dueTime" type="time" value="${defaults.time}" required></label>
    <label>Rappel automatique<select name="reminderMode"><option value="none">Aucun</option><option value="1h">Toutes les heures</option><option value="2h">Toutes les 2 heures</option><option value="4h">Toutes les 4 heures</option></select></label>
    <label class="wide">Notes<textarea name="notes" placeholder="Ajouter une note"></textarea></label>
    <button class="primary-action visible wide" type="submit">Valider</button>`;
}

function productRowMarkup(product = {}) {
  return `<article class="product-row">
    <label>Produit<input name="productName" value="${escapeHtml(product.name || "")}" placeholder="Blue Label"></label>
    <label>Qté demandée<input name="productRequested" type="number" min="0" inputmode="numeric" value="${product.requested || ""}" placeholder="12"></label>
    <label>Stock dispo<input name="productAvailable" type="number" min="0" inputmode="numeric" value="${product.available || ""}" placeholder="10"></label>
    <strong class="product-state">✅ Disponible</strong>
    <button class="remove-product" type="button" aria-label="Supprimer produit">×</button>
  </article>`;
}

function bindProductCreator() {
  const rows = document.querySelector("#productRows");
  const sync = () => updateCreatorProductSummary();
  rows.addEventListener("input", sync);
  rows.addEventListener("click", (event) => {
    const remove = event.target.closest(".remove-product");
    if (!remove) return;
    const row = remove.closest(".product-row");
    if (rows.querySelectorAll(".product-row").length > 1) row.remove();
    sync();
  });
  document.querySelector("#addProductRow").addEventListener("click", () => {
    rows.insertAdjacentHTML("beforeend", productRowMarkup());
    sync();
  });
  sync();
}

function updateCreatorProductSummary() {
  const products = collectProductsFromForm();
  document.querySelectorAll(".product-row").forEach((row, index) => {
    const product = products[index] || {};
    const state = row.querySelector(".product-state");
    state.textContent = product.name || product.requested || product.available ? productStateLabel(product) : "État";
    state.classList.toggle("has-missing", Boolean(productMissing(product)));
  });
  document.querySelector("#productSummaryBox").innerHTML = productSummaryMarkup(products);
}

function collectProductsFromForm() {
  return [...document.querySelectorAll(".product-row")].map((row, index) => ({
    id: row.dataset.productId || `product-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    name: row.querySelector('[name="productName"]')?.value.trim() || "",
    requested: Number(row.querySelector('[name="productRequested"]')?.value || 0),
    available: Number(row.querySelector('[name="productAvailable"]')?.value || 0),
    prepared: false
  })).filter((product) => product.name || product.requested || product.available);
}

function productSummaryMarkup(products = []) {
  const summary = productSummary(products);
  if (!summary.total) return `<span>Ajoutez au moins un produit.</span>`;
  if (summary.missingCount) {
    return `<strong>⚠️ Produits disponibles</strong><span>${summary.availableCount} / ${summary.total}</span><small>${summary.missingCount} produit${summary.missingCount > 1 ? "s" : ""} manquant${summary.missingCount > 1 ? "s" : ""}</small>`;
  }
  return `<strong>Produits disponibles</strong><span>${summary.availableCount} / ${summary.total}</span>`;
}

function createTask(event, assignee) {
  event.preventDefault();
  if (!requireIdentity()) return;
  const form = new FormData(event.currentTarget);
  const missionType = form.get("missionType");
  const assignedTo = form.get("assignee") || assignee;
  const reminderMode = form.get("reminderMode") || "none";
  const products = missionType === "preparation" ? collectProductsFromForm() : [];
  const requested = products.length ? products.reduce((total, product) => total + Number(product.requested || 0), 0) : Number(form.get("requested") || 0);
  const available = products.length ? products.reduce((total, product) => total + Number(product.available || 0), 0) : Number(form.get("available") || 0);
  const item = { id: `task-${Date.now()}`, title: form.get("title"), missionType, assignee: assignedTo, createdBy: CURRENT_USER, assignedTo, assignedBy: CURRENT_USER, priority: form.get("priority"), dueDate: form.get("dueDate"), dueTime: form.get("dueTime"), due: formatDeadline(form.get("dueDate"), form.get("dueTime")), notes: form.get("notes"), requested, available, products, client: form.get("client") || "", amount: Number(form.get("amount") || 0), quoteDate: form.get("quoteDate") || "", status: statusesForType(missionType)[0], reminderMode, reminderEnabled: reminderMode !== "none", lastReminderAt: null, createdAt: Date.now(), seenBy: [], history: [`Créée par ${CURRENT_USER} — ${dateTimeNow()}`] };
  if (products.length) {
    item.history.push(`Produits ajoutés : ${products.map((product) => `${product.name || "Produit"} (${product.requested})`).join(", ")} — ${dateTimeNow()}`);
  }
  state.tasks.unshift(item);
  addActivity(`${CURRENT_USER} a créé ${item.title} pour ${assignedTo}`);
  if (missingQuantity(item)) addActivity(`⚠️ ${item.title} : manquant ${missingQuantity(item)}`);
  save(item); render(); el.taskDialog.close();
  const pushTitle = item.missionType === "livraison" ? "Nouvelle livraison" : item.priority.includes("Urgente") ? "🔥 Nouvelle tâche urgente" : "Nouvelle tâche Winess Hub";
  const pushBody = item.missionType === "preparation" ? `${CURRENT_USER} vous a assigné une préparation de commande : ${item.title}` : `${CURRENT_USER} vous a assigné une nouvelle tâche : ${item.title}`;
  sendPush(assignedTo, pushTitle, pushBody, `#task-${item.id}`, `task:${item.id}:assigned`);
}

function openTask(id) {
  if (!requireIdentity()) return;
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
  el.taskDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">${typeLabel(item)}</p><h2 id="taskTitleDisplay">${escapeHtml(item.title)}</h2><div class="title-actions">${isDeleted(item) ? "" : `<button id="editTaskTitle" type="button">✏️ Modifier le titre</button>`}</div><p class="assignment-line">Mission assignée à ${item.assignee} par ${item.createdBy} <button class="whatsapp-share" id="shareTask" type="button">WhatsApp</button></p></div></header>
    <section class="title-editor" id="taskTitleEditor" hidden><label>Nouveau titre<input id="taskTitleInput" value="${escapeHtml(item.title)}" maxlength="160"></label></section>
    <section class="assignment-summary"><article><span>Assigné par</span><strong>${item.createdBy}</strong></article><article><span>Assigné à</span><strong>${item.assignee}</strong></article></section>
    <section class="task-detail-grid"><article><span>Statut</span><strong>${isDeleted(item) ? "Supprimée" : item.status}</strong></article><article><span>Priorité</span><strong>${item.priority}</strong></article><article><span>Date limite</span><strong>${formatDue(item)}</strong></article><article><span>Créée</span><strong>${new Date(item.createdAt).toLocaleString("fr-FR")}</strong></article></section>
    ${completionDatesMarkup(item)}
    ${item.missionType === "devis" ? `<section class="quantity-status"><article><span>Client</span><strong>${item.client || "À préciser"}</strong></article><article><span>Montant</span><strong>${formatAmount(item.amount)}</strong></article><article><span>Date du devis</span><strong>${formatDate(item.quoteDate)}</strong></article></section>` : ""}
    ${item.missionType !== "preparation" && (item.requested || item.available) ? `<section class="quantity-status"><article><span>Demandé</span><strong>${item.requested || 0}</strong></article><article><span>Disponible</span><strong>${item.available || 0}</strong></article><article class="${missingQuantity(item) ? "has-missing" : ""}"><span>Manquant</span><strong>${missingQuantity(item)}</strong></article></section>` : ""}
    ${missingQuantity(item) ? `<section class="missing-banner">⚠️ Produit manquant : ${missingQuantity(item)}</section>` : ""}
    ${item.missionType === "preparation" ? preparationDetailMarkup(item) : ""}
    <section class="read-status"><h3>Vu par</h3>${item.seenBy.map((seen) => `<p>👁 Vu par ${seen.user} — ${seen.date || dateNow()} ${seen.time}</p>`).join("") || `<p>Pas encore vue</p>`}</section>
    ${item.reminderEnabled ? `<section class="auto-reminder-state">Rappel auto ${reminderLabel(item.reminderMode)} activé${item.lastReminderAt ? ` · dernier envoi ${new Date(item.lastReminderAt).toLocaleString("fr-FR")}` : ""}</section>` : ""}
    <section class="task-form single"><label>Notes<textarea id="taskNotes" ${isDeleted(item) ? "disabled" : ""}>${item.notes || ""}</textarea></label><div class="quantity-edit"><label>Date limite<input id="taskDueDate" type="date" value="${item.dueDate || ""}" ${isDeleted(item) ? "disabled" : ""}></label><label>Heure limite<input id="taskDueTime" type="time" value="${item.dueTime || ""}" ${isDeleted(item) ? "disabled" : ""}></label></div>${item.missionType !== "preparation" ? `<div class="quantity-edit"><label>Demandé<input id="taskRequested" type="number" min="0" value="${item.requested || 0}" ${isDeleted(item) ? "disabled" : ""}></label><label>Disponible<input id="taskAvailable" type="number" min="0" value="${item.available || 0}" ${isDeleted(item) ? "disabled" : ""}></label></div>` : ""}${item.missionType === "devis" ? `<div class="quantity-edit"><label>Client<input id="taskClient" value="${item.client || ""}"></label><label>Montant<input id="taskAmount" type="number" min="0" step="0.01" value="${item.amount || 0}"></label></div><label>Date du devis<input id="taskQuoteDate" type="date" value="${item.quoteDate || ""}"></label>` : ""}<label>Statut<select id="taskStatus" ${isDeleted(item) ? "disabled" : ""}>${statusesFor(item).map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></label><label>Rappel automatique<select id="taskReminderMode" ${isDeleted(item) || isCompleted(item) ? "disabled" : ""}><option value="none" ${item.reminderMode === "none" ? "selected" : ""}>Aucun rappel</option><option value="1h" ${item.reminderMode === "1h" ? "selected" : ""}>Toutes les heures</option><option value="2h" ${item.reminderMode === "2h" ? "selected" : ""}>Toutes les 2h</option><option value="4h" ${item.reminderMode === "4h" ? "selected" : ""}>Toutes les 4h</option></select></label></section>
    <div class="task-form-actions">${isDeleted(item) ? "" : `<button id="saveTask" type="button">Valider</button>${!isCompleted(item) ? `<button id="validateTask" class="complete-action" type="button">✅ Valider la tâche</button>` : ""}${!isCompleted(item) && item.createdBy === CURRENT_USER ? `<button id="remindTask" type="button">Relancer</button>` : ""}<button id="deleteTask" class="danger-action" type="button">Supprimer</button>`}<button id="shareTaskBottom" class="whatsapp-action" type="button">Partager WhatsApp</button></div>
    <details class="task-history"><summary>Historique</summary>${item.history.map((line) => `<p>${line}</p>`).join("")}</details>`;
  document.querySelector("#saveTask")?.addEventListener("click", () => saveTaskDetails(item));
  document.querySelector("#editTaskTitle")?.addEventListener("click", () => {
    const editor = document.querySelector("#taskTitleEditor");
    editor.hidden = false;
    document.querySelector("#taskTitleInput").focus();
  });
  document.querySelector("#shareTask").addEventListener("click", () => shareTask(item));
  document.querySelector("#shareTaskBottom").addEventListener("click", () => shareTask(item));
  document.querySelectorAll("[data-product-check]").forEach((input) => input.addEventListener("change", () => toggleProductPrepared(item, input.dataset.productCheck, input.checked)));
  document.querySelector("#finishPreparation")?.addEventListener("click", () => finishPreparation(item));
  document.querySelector("#validateTask")?.addEventListener("click", () => validateTask(item));
  document.querySelector("#remindTask")?.addEventListener("click", () => remindTask(item.id));
  document.querySelector("#deleteTask")?.addEventListener("click", () => deleteTask(item));
  el.taskDialog.showModal();
}

function validateTask(item) {
  const statusSelect = document.querySelector("#taskStatus");
  if (statusSelect) statusSelect.value = "Validé";
  saveTaskDetails(item);
}

function preparationDetailMarkup(item) {
  const products = normalizeProducts(item);
  const summary = productSummary(products);
  return `<section class="preparation-panel">
    <header><h3>Produits à préparer</h3><span>${summary.availableCount} / ${summary.total || 0} disponibles</span></header>
    <div class="prep-products">${products.map((product) => `<label class="prep-product ${product.prepared ? "is-prepared" : ""}">
      <input data-product-check="${product.id}" type="checkbox" ${product.prepared ? "checked" : ""} ${isCompleted(item) || isDeleted(item) ? "disabled" : ""}>
      <span><strong>${escapeHtml(product.name || "Produit")}</strong><small>Demandé ${product.requested || 0} · Stock ${product.available || 0} · ${escapeHtml(productStateLabel(product))}</small></span>
    </label>`).join("") || `<p class="empty-state">Aucun produit renseigné.</p>`}</div>
    ${summary.missingCount ? `<div class="missing-banner">⚠️ ${summary.missingCount} produit${summary.missingCount > 1 ? "s" : ""} manquant${summary.missingCount > 1 ? "s" : ""}</div>` : `<div class="available-banner">✅ Toute la commande est disponible</div>`}
    ${!isCompleted(item) && !isDeleted(item) ? `<button id="finishPreparation" class="complete-action prep-finish" type="button">Préparation terminée</button>` : ""}
  </section>`;
}

function toggleProductPrepared(item, productId, checked) {
  const product = item.products?.find((entry) => entry.id === productId);
  if (!product) return;
  product.prepared = checked;
  item.history.push(`${checked ? "Produit préparé" : "Produit décoché"} : ${product.name || "Produit"} — ${dateTimeNow()}`);
  addActivity(`${CURRENT_USER} ${checked ? "a préparé" : "a décoché"} ${product.name || "un produit"} sur ${item.title}`);
  save(item);
  render();
  openTask(item.id);
}

function finishPreparation(item) {
  const everythingAvailable = confirm("Toute la commande est-elle disponible ?\n\nOK = Oui\nAnnuler = Non");
  const previousStatus = item.status;
  const missing = item.products.filter((product) => !product.prepared || productMissing(product));
  item.status = everythingAvailable ? "Prête" : "Prête avec manquants";
  if (everythingAvailable) item.products.forEach((product) => { product.prepared = true; });
  item.history.push(`Préparation terminée par ${CURRENT_USER} — ${dateTimeNow()}`);
  if (!everythingAvailable && missing.length) {
    item.history.push(`Produits manquants : ${missing.map((product) => product.name || "Produit").join(", ")} — ${dateTimeNow()}`);
  }
  recordStatusActivity(item, item.status, previousStatus);
  save(item);
  render();
  el.taskDialog.close();
  const body = everythingAvailable
    ? `${CURRENT_USER} a terminé la préparation. Tout est disponible.`
    : `${CURRENT_USER} a terminé la préparation. Commande prête avec manquants : ${missing.map((product) => product.name || "Produit").join(", ")}`;
  sendPush(item.createdBy, everythingAvailable ? "Commande prête" : "Commande prête avec manquants", body, `#task-${item.id}`, `task:${item.id}:preparation-finished:${item.status}`);
  showToast(everythingAvailable ? "Préparation prête" : "Préparation prête avec manquants");
}

function saveTaskDetails(item) {
  const previousStatus = item.status;
  const previousMissing = missingQuantity(item);
  const previousTitle = item.title;
  const nextTitle = document.querySelector("#taskTitleInput")?.value.trim();
  if (nextTitle) item.title = nextTitle;
  item.notes = document.querySelector("#taskNotes").value;
  const dueDate = document.querySelector("#taskDueDate").value;
  const dueTime = document.querySelector("#taskDueTime").value;
  if (dueDate) {
    item.dueDate = dueDate;
    item.dueTime = dueTime;
    item.due = formatDeadline(dueDate, dueTime);
  }
  item.requested = document.querySelector("#taskRequested") ? Number(document.querySelector("#taskRequested").value || 0) : (item.products || []).reduce((total, product) => total + Number(product.requested || 0), 0);
  item.available = document.querySelector("#taskAvailable") ? Number(document.querySelector("#taskAvailable").value || 0) : (item.products || []).reduce((total, product) => total + Number(product.available || 0), 0);
  if (item.missionType === "devis") {
    item.client = document.querySelector("#taskClient").value;
    item.amount = Number(document.querySelector("#taskAmount").value || 0);
    item.quoteDate = document.querySelector("#taskQuoteDate").value;
  }
  item.status = document.querySelector("#taskStatus").value;
  item.reminderMode = document.querySelector("#taskReminderMode")?.value || "none";
  item.reminderEnabled = item.reminderMode !== "none" && !isCompleted(item);
  if (!item.reminderEnabled) item.lastReminderAt = null;
  if (item.title !== previousTitle) {
    item.history.push(`${CURRENT_USER} a modifié le titre : "${previousTitle}" → "${item.title}" — ${dateTimeNow()}`);
    addActivity(`${CURRENT_USER} a modifié le titre : ${previousTitle} → ${item.title}`);
  } else {
    item.history.push(`Modifiée par ${CURRENT_USER} — ${dateTimeNow()}`);
  }

  if (item.status !== previousStatus) recordStatusActivity(item, item.status, previousStatus);
  if (missingQuantity(item) && missingQuantity(item) !== previousMissing) {
    item.history.push(`⚠️ Manquant signalé : ${missingQuantity(item)} — ${dateTimeNow()}`);
    addActivity(`${CURRENT_USER} a signalé un manquant de ${missingQuantity(item)} sur ${item.title}`);
    sendPush(item.createdBy, "Produit manquant", `${item.title} : manquant ${missingQuantity(item)}`, `#task-${item.id}`, `task:${item.id}:missing:${missingQuantity(item)}`);
  }
  save(item); render(); el.taskDialog.close();
  showToast(isCompleted(item) ? "Tâche déplacée dans les archives" : "Modifications enregistrées");
}

function recordStatusActivity(item, status, previousStatus = "") {
  const finalKind = finalStatusKind(status);
  const wording = ["En cours", "Pris en charge", "En livraison"].includes(status)
    ? `a pris en charge "${item.title}"`
    : ["Prête", "Prêt départ"].includes(status)
      ? `a indiqué "${item.title}" prête`
      : status === "Prête avec manquants"
        ? `a indiqué "${item.title}" prête avec manquants`
      : finalKind === "recovered"
        ? `a récupéré "${item.title}"`
        : finalKind === "delivered"
          ? `a livré "${item.title}"`
          : finalKind === "validated"
            ? `a validé "${item.title}"`
            : finalKind === "completed"
              ? `a terminé "${item.title}"`
              : `a passé "${item.title}" en ${status}`;
  applyCompletionMetadata(item, previousStatus);
  item.history.push(`${status} par ${CURRENT_USER} — ${dateTimeNow()}`);
  addActivity(`${CURRENT_USER} ${wording}`);
  const eventId = `task:${item.id}:status:${status}`;
  if (["En cours", "Pris en charge", "En livraison"].includes(status)) sendPush(item.createdBy, "Tâche prise en charge", `${CURRENT_USER} a pris en charge la tâche : ${item.title}`, `#task-${item.id}`, eventId);
  if (status === "Prête") sendPush(item.createdBy, "Commande prête", `${item.title} est prête`, `#task-${item.id}`, eventId);
  if (status === "Prête avec manquants") sendPush(item.createdBy, "Commande prête avec manquants", `${item.title} est prête avec manquants`, `#task-${item.id}`, eventId);
  if (status === "Récupérée") sendPush(item.createdBy, "Commande récupérée", `${item.title} a été récupérée`, `#task-${item.id}`, eventId);
  if (status === "Prêt départ") sendPush(item.createdBy, "Livraison prête", `${item.title} est prête au départ`, `#task-${item.id}`, eventId);
  if (status === "Livré") sendPush(item.createdBy, "Livraison livrée", `${item.title} a été livrée`, `#task-${item.id}`, eventId);
  if (isCompleted(item) && !["Prête", "Prête avec manquants", "Récupérée", "Livré"].includes(status)) sendPush(item.createdBy, "Tâche terminée", `${CURRENT_USER} a validé la tâche : ${item.title}`, `#task-${item.id}`, eventId);
}

function shareTask(item) {
  const url = `${APP_BASE_URL}index.html?v=${APP_VERSION}#task-${item.id}`;
  const text = `Mission : ${item.title}\nAssigné à : ${item.assignee}\nAssigné par : ${item.createdBy}\nStatut : ${item.status}\nPriorité : ${item.priority}\nDate limite : ${formatDue(item)}\nNotes : ${item.notes || "Aucune"}\nLien : ${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const opened = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  if (!opened) location.href = whatsappUrl;
}

function updateStatus(value) {
  const [id, status] = value.split(":");
  const item = state.tasks.find((task) => task.id === id);
  if (!item) return;
  const previousStatus = item.status;
  item.status = status;
  recordStatusActivity(item, status, previousStatus);
  save(item); render();
  showToast(isCompleted(item) ? "Tâche déplacée dans les archives" : `Statut : ${status}`);
}

function applyCompletionMetadata(item, previousStatus) {
  if (!isCompleted(item)) {
    if (isCompletedStatus(previousStatus)) item.completedAt = null;
    return;
  }
  const timestamp = new Date().toISOString();
  if (!isCompletedStatus(previousStatus) || !item.completedAt) item.completedAt = timestamp;
  item.completedBy = CURRENT_USER;
  item.reminderEnabled = false;
  const kind = finalStatusKind(item.status);
  if (["validated", "completed"].includes(kind)) item.validatedAt = timestamp;
  if (kind === "recovered") item.retrievedAt = timestamp;
  if (kind === "delivered") item.deliveredAt = timestamp;
}

async function remindTask(id) {
  const item = state.tasks.find((task) => task.id === id);
  if (!item || isArchived(item)) return;
  if (item.createdBy !== CURRENT_USER) {
    showToast(`Seul ${item.createdBy} peut relancer cette mission`);
    return;
  }
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  const historyLine = `Relance envoyée par ${CURRENT_USER} — ${dateTimeNow()}`;
  item.history.push(historyLine);
  addActivity(`${CURRENT_USER} a relancé ${item.assignee} pour ${item.title}`);
  save(item); render();
  if (el.taskDialog.open) document.querySelector(".task-history")?.insertAdjacentHTML("beforeend", `<p>${historyLine}</p>`);
  const pushed = await sendPush(item.assignee, "Tâche relancée", `${CURRENT_USER} vous a relancé pour la tâche : ${item.title}`, `#task-${item.id}`, `task:${item.id}:remind:${bucket}`);
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
    if (member) { event.stopPropagation(); el.searchResults.hidden = true; openMember(member.dataset.member); return; }
    const view = event.target.closest("[data-open-view]");
    if (view) { event.stopPropagation(); el.searchResults.hidden = true; showView(view.dataset.openView); return; }
    const searchFilter = event.target.closest("[data-search-filter]");
    if (searchFilter) {
      event.stopPropagation();
      activeSearchFilter = searchFilter.dataset.searchFilter;
      el.searchFilters.querySelectorAll("[data-search-filter]").forEach((button) => button.classList.toggle("is-active", button === searchFilter));
      render();
      renderSearchResults(el.globalSearch.value);
    }
  });
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close()));
  document.querySelector("#sidebarToggle").addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));
  document.querySelector("#enablePushButton").addEventListener("click", enablePush);
  document.querySelector("#changeProfileButton").addEventListener("click", changeProfile);
  el.profileGate.addEventListener("cancel", (event) => event.preventDefault());
  el.avatarUpload.addEventListener("change", updateAvatar);
  el.globalSearch.addEventListener("input", () => {
    clearTimeout(searchInputTimer);
    searchInputTimer = window.setTimeout(() => renderSearchResults(el.globalSearch.value), 70);
  });
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
  let avatarData = "";
  try {
    avatarData = await compressAvatar(file);
  } catch {
    showToast("Cette photo ne peut pas être lue");
    return;
  }
  state.avatars[selectedAvatar] = avatarData;
  save();
  render();
  showToast("Photo enregistrée, synchronisation...");

  if (supabaseClient) {
    try {
      const extension = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
      const path = `${selectedAvatar}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabaseClient.storage.from("avatars").upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabaseClient.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: profileError } = await supabaseClient.from("hub_profiles").update({ avatar_url: avatarUrl, updated_by: memberIdForName(CURRENT_USER) }).eq("id", selectedAvatar);
      if (profileError) throw profileError;
      state.avatars[selectedAvatar] = avatarUrl;
      broadcastChange("profile_changed", { profile: { id: selectedAvatar, avatar_url: avatarUrl } });
      save(); render(); showToast("Photo de profil synchronisée");
      event.target.value = "";
      return;
    } catch {
      const synced = await syncProfileFallback(selectedAvatar, avatarData);
      if (synced) {
        showToast("Photo synchronisée sur tous les appareils");
        event.target.value = "";
        return;
      }
    }
  }
  showToast("Photo conservée sur cet appareil uniquement");
  event.target.value = "";
}

function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const size = 384;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context || !image.naturalWidth || !image.naturalHeight) { reject(new Error("Image invalide")); return; }
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - sourceSize) / 2;
        const sourceY = (image.naturalHeight - sourceSize) / 2;
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function enablePush() {
  if (!requireIdentity()) return;
  el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Pour recevoir les notifications, ajoute Winess Hub à l’écran d’accueil puis ouvre l’app depuis l’icône.</span>`;
  el.iphoneHelp.classList.add("is-visible");
  if (!matchMedia("(display-mode: standalone)").matches && navigator.standalone !== true) {
    el.pushState.textContent = "Ajoutez d’abord Winess Hub à l’écran d’accueil";
    return;
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    el.pushState.textContent = "Notifications non supportées sur ce navigateur";
    return;
  }
  if (VAPID_PUBLIC_KEY.includes("REMPLACE_MOI")) {
    el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>La clé publique VAPID doit être configurée.</span>`;
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
  const response = await callEdgeFunction("subscribe-push", { user_id: memberIdForName(CURRENT_USER), subscription });
  if (!response.ok) throw new Error("Impossible d’enregistrer l’abonnement push");
  el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Notifications activées.</span>`;
  el.pushState.textContent = `Notifications activées pour ${CURRENT_USER}`;
}

async function sendPush(userName, title, body, url, eventId = "") {
  const user = members.find((member) => member.name === userName);
  if (!user) return false;
  try {
    const notificationUrl = absoluteNotificationUrl(url);
    const response = await callEdgeFunction("notify-push", { user_id: user.id, title, body, url: notificationUrl, event_id: eventId });
    return response.ok;
  } catch {
    return false;
  }
}

function absoluteNotificationUrl(value) {
  if (!value) return APP_BASE_URL;
  if (value.startsWith("#")) return `${APP_BASE_URL}index.html${value}`;
  try {
    const candidate = new URL(value, APP_BASE_URL);
    return candidate.origin === "https://steven77726.github.io" && candidate.pathname.startsWith("/WINESS-HUB/") ? candidate.href : APP_BASE_URL;
  } catch {
    return APP_BASE_URL;
  }
}

function callEdgeFunction(functionName, body) {
  return fetch(`${EDGE_FUNCTION_BASE}/${functionName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY, "x-client-info": "winess-hub-web" },
    body: JSON.stringify(body)
  });
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
function requireIdentity() {
  if (members.some((member) => member.name === CURRENT_USER)) return true;
  showProfileChooser();
  return false;
}
function reminderLabel(mode) { return mode === "4h" ? "4h" : mode === "daily" ? "quotidien" : "désactivé"; }
function escapeHtml(value) { return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
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

function completionDatesMarkup(item) {
  const dates = [
    ["Validation", item.validatedAt],
    ["Récupération", item.retrievedAt],
    ["Livraison", item.deliveredAt],
    ["Finalisation", item.completedAt]
  ].filter(([, value]) => value);
  if (!dates.length) return "";
  return `<section class="completion-dates">${dates.map(([label, value]) => `<article><span>${label}</span><strong>${new Date(value).toLocaleString("fr-FR")}</strong></article>`).join("")}</section>`;
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
      supabaseClient.from("hub_activity").select("id,event_time,text,created_at").order("created_at", { ascending: false }).limit(1000),
      supabaseClient.from("hub_profiles").select("id,avatar_url,updated_at")
    ]);
    if (taskError || activityError) throw taskError || activityError;

    const fallbackProfiles = remoteTasks.filter((row) => row.data?.kind === "profile");
    const taskRows = remoteTasks.filter((row) => row.data?.kind !== "profile");
    if (taskRows.length) {
      state.tasks = taskRows.map((row) => migrateTask({ ...row.data, id: row.id }, row.updated_at));
    } else {
      const { error } = await supabaseClient.from("hub_tasks").upsert(state.tasks.map(taskRow));
      if (error) throw error;
    }
    if (remoteActivity.length) {
      state.activity = remoteActivity.map((row) => ({ id: row.id, time: row.event_time, text: row.text, createdAt: new Date(row.created_at).getTime() }));
    }
    fallbackProfiles.forEach((row) => { if (row.data?.avatar) state.avatars[row.data.profileId] = row.data.avatar; });
    (remoteProfiles || []).forEach((profile) => { if (profile.avatar_url) state.avatars[profile.id] = profile.avatar_url; });
    const knownProfileIds = new Set([...fallbackProfiles.map((row) => row.data?.profileId), ...(remoteProfiles || []).map((profile) => profile.id)]);
    const profilesToMigrate = Object.entries(state.avatars).filter(([id, avatar]) => !knownProfileIds.has(id) && String(avatar).startsWith("data:image/"));
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
    realtimeChannel.subscribe(async (status) => {
      setSyncState(status === "SUBSCRIBED" ? "Temps réel" : "Connexion...", status === "SUBSCRIBED");
      if (status === "SUBSCRIBED" && profilesToMigrate.length) await Promise.all(profilesToMigrate.map(([id, avatar]) => syncProfileFallback(id, avatar)));
    });
  } catch (error) {
    console.warn("Supabase indisponible, stockage local conservé.", error);
    setSyncState("Mode local", false);
  }
}

function taskRow(item) {
  return { id: item.id, data: item, assigned_to: memberIdForName(item.assignee), assigned_by: memberIdForName(item.createdBy), status: item.status, reminder_mode: item.reminderMode || "none", reminder_enabled: Boolean(item.reminderEnabled), last_reminder_at: item.lastReminderAt || null, completed_at: item.completedAt || null, validated_at: item.validatedAt || null, retrieved_at: item.retrievedAt || null, delivered_at: item.deliveredAt || null, updated_by: memberIdForName(CURRENT_USER || "system") };
}

async function syncTask(item) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from("hub_tasks").upsert(taskRow(item));
  if (error) setSyncState("Hors ligne", false);
  else broadcastChange("task_changed", { task: item });
}

async function syncActivity(event) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from("hub_activity").upsert({ id: event.id, event_time: event.time, text: event.text, created_by: memberIdForName(CURRENT_USER || "system") });
  if (error) setSyncState("Hors ligne", false);
  else broadcastChange("activity_added", { activity: event });
}

async function syncProfileFallback(profileId, avatar) {
  if (!supabaseClient) return false;
  const profile = { kind: "profile", profileId, avatar, updatedAt: Date.now(), updatedBy: memberIdForName(CURRENT_USER) };
  const { error } = await supabaseClient.from("hub_tasks").upsert({ id: `profile:${profileId}`, data: profile, updated_by: profile.updatedBy });
  if (error) return false;
  broadcastChange("profile_changed", { profile: { id: profileId, avatar_url: avatar } });
  return true;
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
  if (payload.new?.data?.kind === "profile") {
    applyRemoteProfile({ new: { id: payload.new.data.profileId, avatar_url: payload.new.data.avatar } });
    return;
  }
  const index = state.tasks.findIndex((item) => item.id === id);
  if (payload.eventType === "DELETE") {
    if (index >= 0) state.tasks.splice(index, 1);
  } else {
    const item = migrateTask({ ...payload.new.data, id }, payload.new.updated_at);
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
