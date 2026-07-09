import { finalStatusKind, isCompletedStatus, normalizedStatusKey } from "./task-status.js";

const STORAGE_KEY = "winess-hub:v260";
const DEVICE_PROFILE_KEY = "winess-hub:device-profile:v1";
const DEVICE_ID_KEY = "winess-hub:device-id";
const LAST_TASK_KEY = "winess-hub:last-task:v1";
const PROFILE_VALIDITY = 30 * 24 * 60 * 60 * 1000;
const deviceSession = readDeviceSession();
let CURRENT_USER = deviceSession?.name || "";
const TWO_HOURS = 2 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const SUPABASE_URL = "https://xzcshuoelidzdlihnwme.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_KI7h19VdLtB2YfXBsN4bAw_9KQMxNBs";
const APP_BASE_URL = "https://steven77726.github.io/WINESS-HUB/";
const APP_VERSION = "326";
const IS_FILE_MODE = location.protocol === "file:";
const IS_CAPACITOR = ["capacitor:", "ionic:"].includes(location.protocol) || Boolean(window.Capacitor?.isNativePlatform?.());
const CLIENT_ENV = IS_CAPACITOR ? "capacitor-ios" : IS_FILE_MODE ? "file" : "web";
let supabaseClient = null;
let realtimeChannel = null;
const CLIENT_ID = crypto.randomUUID?.() || `client-${Date.now()}-${Math.random()}`;
const DEVICE_ID = getDeviceId();
const EDGE_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;
const VAPID_PUBLIC_KEY = "BDEUT7mYiel6Ns3NpHSHgegKWk7jGK43pGrM9zR_MRl_A4zbfYD9oLQbSHscM8_OVkHTkjrBVW2-m0RTBrWqrAw";
const STUART_PACKAGES = {
  xsmall: { label: "Très petit", detail: "20 × 15 × 20 cm", api: "xsmall" },
  small: { label: "Petit", detail: "50 × 30 × 30 cm", api: "small" },
  medium: { label: "Moyen", detail: "55 × 40 × 40 cm", api: "medium" },
  large: { label: "Large", detail: "90 × 65 × 50 cm", api: "large" },
  xlarge: { label: "Extra-large", detail: "100 × 90 × 50 cm", api: "xlarge" }
};

const MISSION_TYPES = {
  preparation: { label: "📦 Préparation commande", statuses: ["Attribué", "En cours", "Prête", "Prête avec manquants", "Récupérée", "Terminée"] },
  blocage: { label: "📌 Blocage produit", statuses: ["Demandé", "Bloqué", "Récupéré"] },
  livraison: { label: "🚚 Livraison", statuses: ["Créée", "Course demandée", "Coursier accepté", "Coursier arrivé", "Commande récupérée", "En livraison", "Livrée", "Annulée"] },
  inventaire: { label: "📊 Inventaire", statuses: ["Attribué", "En cours", "Terminé"] },
  rappel: { label: "📞 Rappel client", statuses: ["Attribué", "Pris en charge", "Terminé"] },
  litige: { label: "⚠️ Litige", statuses: ["Attribué", "Pris en charge", "Terminé"] },
  fournisseur: { label: "🛒 Commande fournisseur", statuses: ["Attribué", "En cours", "Commandée", "Terminée"] },
  ecart_caisse: { label: "💶 Écart de caisse", statuses: ["Attribué", "Pris en charge", "Validé"] },
  devis_simple: { label: "📝 Devis", statuses: ["Attribué", "En cours", "Validé"] },
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
const mentionableMembers = [...members, { id: "didier", name: "Didier", role: "Équipe" }];

const seedTasks = [
  task("azran", "Préparer commande Azran", "preparation", "Théo", "David", "🔥 Urgente", "Aujourd'hui 15h", "Préparer la commande magasin.", 25, "Attribué", 12, 10),
  task("azul", "Vérifier stock Azul", "inventaire", "Steven", "Zac", "🔥 Urgente", "Aujourd'hui 15h", "Contrôler le disponible réel.", 90, "En cours"),
  task("litige", "Valider litige fournisseur", "litige", "David", "Steven", "Haute", "Aujourd'hui 16h", "Écart de prix à arbitrer.", 140),
  task("cohen", "Rappeler Madame Cohen", "rappel", "Zac", "Steven", "🔥 Urgente", "Aujourd'hui 17h", "Client à rappeler avant 18h.", 40),
  task("facture", "Contrôler anomalie facture", "autre", "Valérie", "David", "Normale", "Demain matin", "Vérifier le montant.", 12)
];

const defaultAddressBook = [
  {
    id: "avi-rebibo",
    firstName: "Avi",
    lastName: "Rebibo",
    company: "",
    address: "",
    address2: "",
    postcode: "",
    city: "Neuilly",
    phone: "",
    accessCode: "",
    floor: "",
    elevator: "",
    courierInstructions: ""
  }
];

const state = loadState();
let selectedAvatar = "";
let openedTaskId = "";
let toastTimer = 0;
let homeExpiryTimer = 0;
let stuartPollTimer = 0;
let activeSearchFilter = "all";
let searchInputTimer = 0;
let pendingMessageId = "";
let lastViewHash = location.hash.startsWith("#view-") ? location.hash : "#view-accueil";
let nativePushBound = false;

const el = {
  direction: document.querySelector("#directionGrid"),
  staff: document.querySelector("#staffGrid"),
  urgent: document.querySelector("#urgentList"),
  smartHome: document.querySelector("#smartHome"),
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
  addressSearch: document.querySelector("#addressSearch"),
  addressBookList: document.querySelector("#addressBookList"),
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
  bindNativeViewport();
  bindTouchStability();
  initializeNativeShell();
  bindNativePushListeners();
  initializeSupabase().finally(initializeIdentity);
  logRuntimeEnvironment();
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

function logRuntimeEnvironment() {
  console.info("Winess Hub runtime", {
    env: CLIENT_ENV,
    protocol: location.protocol,
    origin: location.origin,
    href: location.href,
    capacitor: Boolean(window.Capacitor),
    localStorage: storageAvailable(),
    serviceWorker: "serviceWorker" in navigator
  });
}

function bindNativeViewport() {
  const apply = () => {
    const viewport = window.visualViewport;
    const height = viewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--app-viewport-height", `${Math.round(height)}px`);
    document.documentElement.style.setProperty("--app-viewport-top", `${Math.round(viewport?.offsetTop || 0)}px`);
  };
  apply();
  window.visualViewport?.addEventListener("resize", apply);
  window.visualViewport?.addEventListener("scroll", apply);
  window.addEventListener("orientationchange", () => window.setTimeout(apply, 250));
}

function initializeNativeShell() {
  document.body.classList.toggle("is-capacitor", IS_CAPACITOR);
  configureNativeKeyboard();
  window.setTimeout(hideNativeSplash, IS_CAPACITOR ? 1250 : 900);
}

function nativePlugin(name) {
  return window.Capacitor?.Plugins?.[name] || null;
}

async function hideNativeSplash() {
  document.querySelector("#nativeSplash")?.classList.add("is-hidden");
  if (!IS_CAPACITOR) return;
  try {
    await nativePlugin("SplashScreen")?.hide?.({ fadeOutDuration: 260 });
  } catch (error) {
    console.warn("SplashScreen hide ignoré", error);
  }
}

function configureNativeKeyboard() {
  if (!IS_CAPACITOR) return;
  const keyboard = nativePlugin("Keyboard");
  if (!keyboard) return;
  keyboard.setAccessoryBarVisible?.({ isVisible: false }).catch?.(() => {});
  keyboard.setResizeMode?.({ mode: "native" }).catch?.(() => {});
  keyboard.addListener?.("keyboardWillShow", (info = {}) => {
    document.documentElement.style.setProperty("--keyboard-height", `${Math.round(info.keyboardHeight || 0)}px`);
    document.body.classList.add("keyboard-open");
  });
  keyboard.addListener?.("keyboardWillHide", () => {
    document.documentElement.style.setProperty("--keyboard-height", "0px");
    document.body.classList.remove("keyboard-open");
  });
}

function bindNativePushListeners() {
  if (!IS_CAPACITOR || nativePushBound) return;
  const push = nativePlugin("PushNotifications");
  if (!push) return;
  nativePushBound = true;
  push.addListener?.("registration", async (token) => {
    try {
      if (!CURRENT_USER) {
        el.pushState.textContent = "Choisissez un profil avant d’activer les notifications";
        return;
      }
      await registerNativePushToken(token.value);
      hapticNotify("SUCCESS");
    } catch (error) {
      console.error("Token push natif non enregistré", connectionDiagnostics("native-push-registration", error));
      hapticNotify("ERROR");
      el.pushState.textContent = "Token iPhone non enregistré";
    }
  });
  push.addListener?.("registrationError", (error) => {
    console.error("Erreur registration push iOS", error);
    hapticNotify("ERROR");
    el.pushState.textContent = "Erreur activation notifications iPhone";
  });
  push.addListener?.("pushNotificationReceived", (notification) => {
    hapticNotify("WARNING");
    showToast(notification?.title || "Nouvelle notification Winess Hub");
  });
  push.addListener?.("pushNotificationActionPerformed", (action) => {
    openNotificationTarget(action?.notification?.data || {});
  });
}

function openNotificationTarget(data = {}) {
  const url = data.url || data.deepLink || data.link || "";
  const taskId = data.taskId || data.task_id || parseTaskIdFromUrl(url);
  const messageId = data.messageId || data.message_id || parseMessageIdFromUrl(url);
  if (taskId) {
    openTask(String(taskId), messageId ? String(messageId) : "");
    return;
  }
  if (url) {
    const parsed = hashFromUrl(url);
    if (parsed) {
      location.hash = parsed.slice(1);
      handleHash();
      return;
    }
  }
  showView("accueil");
}

function parseTaskIdFromUrl(value = "") {
  const hash = hashFromUrl(value);
  const match = hash?.match(/^#task-([^&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function parseMessageIdFromUrl(value = "") {
  const hash = hashFromUrl(value);
  const match = hash?.match(/[?&]message=([^&]+)/) || hash?.match(/&message=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function hashFromUrl(value = "") {
  if (!value) return "";
  if (String(value).startsWith("#")) return String(value);
  try {
    return new URL(String(value), APP_BASE_URL).hash || "";
  } catch {
    return "";
  }
}

async function registerNativePushToken(token) {
  if (!token) throw new Error("Token APNs absent");
  const response = await callEdgeFunction("subscribe-push", {
    user_id: memberIdForName(CURRENT_USER),
    subscription: {
      type: "apns",
      token,
      platform: "ios",
      appId: "fr.winesshub.app",
      deviceId: DEVICE_ID,
      env: CLIENT_ENV
    }
  });
  const result = await safeJson(response);
  if (!response.ok || !result.ok) throw new Error(result.error || "Abonnement iPhone refusé");
  el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Notifications natives activées pour ${CURRENT_USER}.</span>`;
  el.iphoneHelp.classList.add("is-visible");
  el.pushState.textContent = `Notifications iPhone actives pour ${CURRENT_USER}`;
}

function hapticImpact(style = "LIGHT") {
  if (!IS_CAPACITOR) return;
  nativePlugin("Haptics")?.impact?.({ style }).catch?.(() => {});
}

function hapticNotify(type = "SUCCESS") {
  if (!IS_CAPACITOR) return;
  nativePlugin("Haptics")?.notification?.({ type }).catch?.(() => {});
}

function bindTouchStability() {
  let touchStartX = 0;
  let touchStartY = 0;
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });
  document.addEventListener("touchmove", (event) => {
    if (event.touches.length > 1) {
      event.preventDefault();
      return;
    }
    const deltaX = Math.abs(event.touches[0].clientX - touchStartX);
    const deltaY = Math.abs(event.touches[0].clientY - touchStartY);
    if (deltaX > 10 && deltaX > deltaY * 1.2) event.preventDefault();
  }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener("touchend", (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 320) event.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
}

function storageAvailable() {
  try {
    const key = "winess-hub:storage-test";
    localStorage.setItem(key, "1");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error("Winess Hub stockage local inaccessible en lecture", { key, error });
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error("Winess Hub stockage local inaccessible en écriture", { key, error });
    return false;
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Winess Hub stockage local inaccessible en suppression", { key, error });
  }
}

function readDeviceSession() {
  try {
    const session = JSON.parse(storageGet(DEVICE_PROFILE_KEY) || "null");
    if (!session?.name || !session?.validatedAt || Date.now() - session.validatedAt > PROFILE_VALIDITY) return null;
    return session;
  } catch (error) {
    console.warn("Winess Hub session locale illisible.", error);
    return null;
  }
}

function getDeviceId() {
  let id = storageGet(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || `device-${Date.now()}-${Math.random()}`;
    storageSet(DEVICE_ID_KEY, id);
  }
  return id;
}

function initializeIdentity() {
  const session = readDeviceSession();
  const member = members.find((item) => item.name === session?.name && item.id === session?.userId);
  if (!member) {
    CURRENT_USER = "";
    storageRemove(DEVICE_PROFILE_KEY);
    renderIdentity();
    showProfileChooser();
    return;
  }
  CURRENT_USER = member.name;
  renderIdentity();
  render();
  handleHash();
  maybeResumeLastTask();
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
    const result = await safeJson(response);
    if (!response.ok) throw new Error(result.error || "Profil indisponible");
    renderPinForm(member, result.has_pin ? "verify" : "register");
  } catch (error) {
    console.error("Winess Hub connexion impossible", connectionDiagnostics("profile-pin:status", error));
    hapticNotify("ERROR");
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
    const result = await safeJson(response);
    if (!response.ok || !result.ok) throw new Error(result.error || "PIN incorrect");
    activateProfile(member);
  } catch (error) {
    console.error("Winess Hub PIN refusé", connectionDiagnostics(`profile-pin:${mode}`, error));
    hapticNotify("ERROR");
    errorNode.textContent = error.message;
    submit.disabled = false;
    submit.textContent = mode === "register" ? "Créer mon PIN" : "Continuer";
  }
}

function activateProfile(member) {
  CURRENT_USER = member.name;
  if (!storageSet(DEVICE_PROFILE_KEY, JSON.stringify({ userId: member.id, name: member.name, deviceId: DEVICE_ID, validatedAt: Date.now() }))) {
    console.error("Winess Hub stockage local indisponible", connectionDiagnostics("activate-profile"));
    showToast("Profil validé, mais mémorisation locale impossible");
  }
  storageRemove("winess-hub:current-user");
  el.profileGate.close();
  renderIdentity();
  render();
  handleHash();
  maybeResumeLastTask();
  addActivity(`${member.name} a validé son profil sur cet appareil`);
  showToast(`Profil ${member.name} actif`);
}

function changeProfile() {
  if (CURRENT_USER && !confirm(`Changer le profil ${CURRENT_USER} sur cet appareil ?`)) return;
  const previous = CURRENT_USER;
  if (previous) addActivity(`${previous} a demandé un changement de profil`);
  storageRemove(DEVICE_PROFILE_KEY);
  CURRENT_USER = "";
  renderIdentity();
  render();
  showProfileChooser();
}

function task(id, title, missionType, assignee, createdBy, priority, due, notes, minutesAgo, status, requested = 0, available = 0) {
  const products = missionType === "preparation" && requested ? [{ id: `product-${id}`, name: title.replace(/^Préparer\s*/i, ""), requested, available, prepared: false }] : [];
  const createdAt = Date.now() - minutesAgo * 60000;
  const messages = notes ? [messageRecord(id, createdBy, notes, createdAt, `legacy-${id}`)] : [];
  return { id, title, missionType, assignee, createdBy, assignedTo: assignee, assignedBy: createdBy, priority, due, notes: "", status: status || statusesForType(missionType)[0], requested, available, products, reminderMode: "none", reminderEnabled: false, lastReminderAt: null, createdAt, seenBy: [], messages, history: [`Créée par ${createdBy} — ${dateTimeNow()}`] };
}

function loadState() {
  try {
    const source = storageGet(STORAGE_KEY) || storageGet("winess-hub:v252") || "{}";
    const saved = JSON.parse(source);
    const tasks = (saved.tasks || seedTasks).map(migrateTask);
    return { tasks, avatars: saved.avatars || {}, activity: saved.activity || [], addressBook: (saved.addressBook || defaultAddressBook).map(normalizeContact) };
  } catch {
    return { tasks: seedTasks, avatars: {}, activity: [], addressBook: defaultAddressBook.map(normalizeContact) };
  }
}

function normalizeContact(contact = {}) {
  const hasElevator = typeof contact.hasElevator === "boolean" ? contact.hasElevator : contact.elevator === "Oui" ? true : contact.elevator === "Non" ? false : null;
  return {
    id: contact.id || `contact-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    firstName: contact.firstName || contact.first_name || "",
    lastName: contact.lastName || contact.last_name || "",
    company: contact.company || "",
    phone: contact.phone || "",
    address: contact.address || "",
    address2: contact.address2 || contact.address_extra || "",
    postcode: contact.postcode || contact.postal_code || "",
    city: contact.city || "",
    country: contact.country || "France",
    latitude: Number(contact.latitude || contact.lat || 0) || null,
    longitude: Number(contact.longitude || contact.lon || contact.lng || 0) || null,
    addressLabel: contact.addressLabel || contact.address_label || "",
    addressSelected: Boolean(contact.addressSelected || contact.address_selected),
    accessCode: contact.accessCode || contact.access_code || "",
    floor: contact.floor || "",
    elevator: hasElevator === true ? "Oui" : hasElevator === false ? "Non" : contact.elevator || "",
    hasElevator,
    courierInstructions: contact.courierInstructions || contact.delivery_instructions || "",
    internalNotes: contact.internalNotes || contact.internal_notes || "",
    createdAt: contact.createdAt || contact.created_at || new Date().toISOString(),
    updatedAt: contact.updatedAt || contact.updated_at || new Date().toISOString(),
    archivedAt: contact.archivedAt || contact.archived_at || null
  };
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
  const sourceMessages = Array.isArray(item.messages) && item.messages.length
    ? item.messages
    : item.notes
      ? [messageRecord(item.id, createdBy, item.notes, item.createdAt, `legacy-${item.id}`)]
      : [];
  const messages = sourceMessages.map((message) => ({
    id: message.id || `message-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    author: message.author || "Inconnu",
    authorId: message.authorId || memberIdForName(message.author || "Inconnu"),
    content: String(message.content || ""),
    createdAt: message.createdAt || new Date().toISOString(),
    taskId: message.taskId || item.id,
    mentions: Array.isArray(message.mentions) ? message.mentions : extractMentions(message.content || ""),
    readBy: Array.isArray(message.readBy) ? message.readBy : []
  }));
  return { ...item, missionType, status, assignee, createdBy, assignedTo: assignee, assignedBy: createdBy, completedAt, notes: "", reminderMode, reminderEnabled: reminderMode !== "none" && item.reminderEnabled !== false && !isCompletedStatus(status), lastReminderAt: item.lastReminderAt || null, seenBy: item.seenBy || [], messages, history: item.history || [], products: normalizeProducts(item), requested: Number(item.requested || 0), available: Number(item.available || 0), amount: Number(item.amount || 0) };
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
  storageSet(STORAGE_KEY, JSON.stringify(state));
  if (changedTask) syncTask(changedTask);
}

function render() {
  renderIdentity();
  renderSmartHome();
  renderUrgencies();
  el.direction.innerHTML = members.filter((m) => m.group === "direction").map(memberCard).join("");
  el.staff.innerHTML = members.filter((m) => m.group === "staff").map(memberCard).join("");
  renderMyTasks();
  renderTools();
  renderActivity();
  renderAddressBook();
  renderRubricCounts();
  const currentRubric = location.hash.match(/^#view-rubrique-(.+)$/)?.[1];
  if (currentRubric) renderRubric(currentRubric);
  if (el.globalSearch?.value.trim()) renderSearchResults(el.globalSearch.value);
  scheduleHomeExpiry();
  scheduleStuartPolling();
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

function scheduleStuartPolling() {
  clearTimeout(stuartPollTimer);
  const trackable = state.tasks.filter(isActiveStuartDelivery);
  if (!trackable.length) return;
  stuartPollTimer = window.setTimeout(async () => {
    for (const item of trackable.slice(0, 5)) await refreshStuartStatus(item, false);
    scheduleStuartPolling();
  }, 60_000);
}

function isActiveStuartDelivery(item) {
  if (item.missionType !== "livraison" || !item.stuartJobId || item.stuartTestMode) return false;
  if (item.deletedAt || item.archivedAt) return false;
  if (isCompleted(item)) return false;
  return !["livree", "terminee", "termine", "annulee", "incident", "erreur"].includes(normalizedStatusKey(item.status));
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
    unread: "Aucun message non lu",
    today: "Aucune tâche du jour",
    devis: "Aucun devis à relancer",
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

function renderSmartHome() {
  if (!el.smartHome) return;
  const userName = CURRENT_USER || "Steven";
  const cards = smartHomeCards();
  const lastTask = getLastOpenedTask();
  el.smartHome.innerHTML = `<header class="smart-home-header">
      <div><p class="eyebrow">Accueil intelligent</p><h1>Bonjour ${escapeHtml(userName)}</h1></div>
    </header>
    <div class="smart-home-grid">
      ${cards.map((card) => `<button class="smart-home-card" data-smart-filter="${card.filter}" type="button"><span>${card.icon}</span><strong>${card.label}</strong><em>${card.count}</em></button>`).join("")}
    </div>
    <button class="resume-card ${lastTask ? "is-ready" : ""}" ${lastTask ? `data-open-task="${lastTask.id}"` : ""} type="button">
      <span>▶️ Reprendre où je me suis arrêté</span>
      <strong>${lastTask ? escapeHtml(lastTask.title) : "Aucune fiche récente"}</strong>
    </button>`;
}

function smartHomeCards() {
  const visible = state.tasks.filter((item) => !isDeleted(item));
  const active = visible.filter((item) => !isCompleted(item));
  const today = new Date().toISOString().slice(0, 10);
  const unread = visible.reduce((total, item) => total + unreadMessageCount(item), 0);
  return [
    { icon: "📦", label: "Commandes à préparer", filter: "commandes", count: active.filter((item) => item.missionType === "preparation").length },
    { icon: "🚚", label: "Livraisons Stuart", filter: "livraison", count: active.filter((item) => item.missionType === "livraison").length },
    { icon: "⚠️", label: "Urgences", filter: "urgent", count: active.filter((item) => item.priority?.includes("Urgente") || isOverdue(item)).length },
    { icon: "💬", label: "Messages non lus", filter: "unread", count: unread },
    { icon: "📅", label: "Devis à relancer", filter: "devis", count: active.filter((item) => item.missionType === "devis" || item.missionType === "devis_simple").length },
    { icon: "📋", label: "Tâches du jour", filter: "today", count: active.filter((item) => item.dueDate === today || String(item.due || "").toLowerCase().includes("aujourd")).length }
  ];
}

function getLastOpenedTask() {
  try {
    const saved = JSON.parse(storageGet(LAST_TASK_KEY) || "null");
    if (!saved?.id) return null;
    const task = state.tasks.find((item) => item.id === saved.id && !isDeleted(item));
    return task || null;
  } catch {
    return null;
  }
}

function rememberLastOpenedTask(item, messageId = "") {
  if (!item?.id || isDeleted(item)) return;
  storageSet(LAST_TASK_KEY, JSON.stringify({ id: item.id, messageId, title: item.title, savedAt: Date.now() }));
}

function resumeLastOpenedTask() {
  const task = getLastOpenedTask();
  if (!task) return false;
  try {
    const saved = JSON.parse(storageGet(LAST_TASK_KEY) || "null");
    openTask(task.id, saved?.messageId || "");
    return true;
  } catch {
    openTask(task.id);
    return true;
  }
}

function maybeResumeLastTask() {
  if (!CURRENT_USER || location.hash.startsWith("#task-")) return;
  const task = getLastOpenedTask();
  if (!task) return;
  window.setTimeout(() => {
    if (!CURRENT_USER || location.hash.startsWith("#task-") || el.taskDialog.open) return;
    resumeLastOpenedTask();
  }, 260);
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
      <button class="profile-plus" data-add-task="${member.name}" type="button" aria-label="Nouvelle tâche pour ${member.name}">+</button>
    </div>
    <div class="employee-tags">
      ${tasks.slice(0, 3).map(taskChip).join("") || `<span class="empty-chip">${homeEmptyLabel()}</span>`}
      ${tasks.length > 3 ? `<button class="task-chip more-chip" data-member="${member.id}" type="button">+${tasks.length - 3} autres</button>` : ""}
    </div>
    <div class="employee-bottom"><div><h3>${member.name}</h3><p>${member.role}</p></div></div>
  </article>`;
}

function taskChip(item) {
  const unread = unreadMessageCount(item);
  const unreadBadge = unread ? `<span class="message-unread-badge" aria-label="${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}">💬 ${unread}</span>` : "";
  if (isCompleted(item)) {
    return `<button class="task-chip completed completed-${finalStatusKind(item.status) || "done"}" data-open-task="${item.id}" type="button"><span class="task-chip-title">${escapeHtml(item.title)}</span><span class="task-chip-status">${escapeHtml(item.missionType === "preparation" ? preparationHomeStatus(item) : `${completedStatusIcon(item.status)} ${item.status}`)}</span>${unreadBadge}</button>`;
  }
  const prefix = isOverdue(item) ? "⏰ " : item.priority.includes("Urgente") ? "🔥 " : "";
  const urgent = isOverdue(item) || item.priority.includes("Urgente") ? " urgent" : "";
  return `<button class="task-chip${urgent}" data-open-task="${item.id}" type="button"><span>${prefix}${escapeHtml(item.title)}</span>${unreadBadge}</button>`;
}

function renderMyTasks() {
  const tasks = activeTasksFor(CURRENT_USER);
  el.badge.textContent = tasks.length;
  el.myTasks.innerHTML = tasks.map(toolTask).join("") || `<p class="empty-state">Aucune tâche active.</p>`;
}

function toolTask(item) {
  const unread = unreadMessageCount(item);
  return `<article class="tool-card ${isOverdue(item) ? "red" : "gold"}">
    <button class="task-title-button" data-open-task="${item.id}" type="button">${item.title}${unread ? ` <span class="message-unread-badge">💬 ${unread}</span>` : ""}</button>
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
  const action = key === "livraison" ? `<button class="primary-action visible rubric-create" data-new-delivery type="button">➕ Nouvelle livraison</button>` : "";
  el.rubricList.innerHTML = `${action}<section class="rubric-section"><h3>En cours</h3>${activeTasks.map(rubricCard).join("") || `<p class="empty-state">Aucune tâche en cours.</p>`}</section><section class="rubric-section"><h3>Archivées</h3>${archivedTasks.map(rubricCard).join("") || `<p class="empty-state">Aucune tâche archivée.</p>`}</section>`;
}

function rubricCard(item) {
  const media = [item.photo ? "Photo" : "", item.voice ? "Vocal" : ""].filter(Boolean).join(" · ");
  return `<article class="rubric-card ${isCompleted(item) ? "is-done" : ""}">
    <header><div><strong>${item.title}</strong><p>Assigné à ${item.assignee} par ${item.createdBy}</p></div><span class="workflow-badge">${workflowStage(item)}</span></header>
    <div class="rubric-meta"><span>${item.status}</span><span>${item.priority}</span><span>${formatDue(item)}</span>${item.reminderEnabled ? `<span>Rappel ${reminderLabel(item.reminderMode)}</span>` : ""}</div>
    ${isQuoteType(item.missionType) ? `<div class="quote-summary"><span>${item.client || "Client à préciser"}</span><strong>${formatAmount(item.amount)}</strong></div>` : ""}
    ${taskDiscussionPreview(item) ? `<p class="rubric-notes">${escapeHtml(taskDiscussionPreview(item))}</p>` : ""}
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

function renderAddressBook() {
  if (!el.addressBookList) return;
  const query = normalizeSearch(el.addressSearch?.value || "");
  const contacts = activeContacts()
    .filter((contact) => !query || contactSearchText(contact).includes(query))
    .sort((a, b) => contactFullName(a).localeCompare(contactFullName(b), "fr"));
  el.addressBookList.innerHTML = contacts.map(contactCard).join("") || `<p class="empty-state">Aucun contact trouvé.</p>`;
}

function activeContacts() {
  return state.addressBook.filter((contact) => !contact.archivedAt);
}

function contactSearchText(contact) {
  return normalizeSearch([
    contact.firstName,
    contact.lastName,
    contact.company,
    contact.phone,
    contact.address,
    contact.address2,
    contact.postcode,
    contact.city,
    contact.accessCode,
    contact.courierInstructions,
    contact.internalNotes
  ].filter(Boolean).join(" "));
}

function contactCard(contact) {
  const name = contactFullName(contact);
  return `<article class="contact-card">
    <button class="contact-main" data-edit-contact="${contact.id}" type="button">
      <strong>${escapeHtml(name)}</strong>
      <span>${escapeHtml([contact.company, contact.city].filter(Boolean).join(" · ") || "Destinataire")}</span>
      <small>${escapeHtml([contact.phone, contact.address].filter(Boolean).join(" · ") || "Coordonnées à compléter")}</small>
    </button>
    <div class="contact-actions">
      <button data-edit-contact="${contact.id}" type="button">Modifier</button>
      <button data-archive-contact="${contact.id}" type="button">Archiver</button>
    </div>
  </article>`;
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
    (item.messages || []).map((message) => [message.author, message.content, (message.mentions || []).map((mention) => mention.name).join(" ")].join(" ")).join(" "),
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
    item.linkedOrderTitle,
    item.deliveryContact?.firstName,
    item.deliveryContact?.lastName,
    item.deliveryContact?.company,
    item.deliveryContact?.address,
    item.deliveryContact?.address2,
    item.deliveryContact?.postcode,
    item.deliveryContact?.city,
    item.deliveryContact?.phone,
    item.deliveryContact?.accessCode,
    item.deliveryContact?.courierInstructions,
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
  if (activeSearchFilter === "urgent") return (item.priority?.includes("Urgente") || isOverdue(item)) && !isCompleted(item);
  if (activeSearchFilter === "unread") return unreadMessageCount(item) > 0;
  if (activeSearchFilter === "today") return !isArchived(item) && (item.dueDate === new Date().toISOString().slice(0, 10) || String(item.due || "").toLowerCase().includes("aujourd"));
  if (activeSearchFilter === "devis") return ["devis", "devis_simple"].includes(item.missionType);
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

function bindAddressAutocomplete(root) {
  const input = root?.querySelector("[data-address-input]");
  const suggestions = root?.querySelector(".address-suggestions");
  if (!input || !suggestions) return;
  let timer = 0;
  input.addEventListener("input", () => {
    root.querySelector('[name="addressSelected"]').value = "";
    root.querySelector('[name="latitude"]').value = "";
    root.querySelector('[name="longitude"]').value = "";
    root.querySelector('[name="addressLabel"]').value = "";
    clearTimeout(timer);
    timer = window.setTimeout(() => renderAddressSuggestions(root, input.value), 220);
  });
}

async function renderAddressSuggestions(root, query) {
  const suggestions = root.querySelector(".address-suggestions");
  if (!suggestions) return;
  const value = query.trim();
  if (value.length < 3) {
    suggestions.innerHTML = "";
    return;
  }
  try {
    const response = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(value)}&limit=5&type=housenumber&lat=48.8792&lon=2.2941`);
    if (!response.ok) throw new Error("Adresse indisponible");
    const data = await response.json();
    const features = data.features || [];
    suggestions.innerHTML = features.map((feature, index) => {
      const label = feature.properties?.label || "";
      return `<button data-address-index="${index}" type="button">${escapeHtml(label)}</button>`;
    }).join("") || `<span>Aucune adresse trouvée.</span>`;
    suggestions.querySelectorAll("[data-address-index]").forEach((button) => {
      button.addEventListener("click", () => applyAddressSuggestion(root, features[Number(button.dataset.addressIndex)]));
    });
  } catch {
    suggestions.innerHTML = `<span>Impossible de rechercher l’adresse.</span>`;
  }
}

function applyAddressSuggestion(root, feature) {
  const properties = feature?.properties || {};
  const coordinates = feature?.geometry?.coordinates || [];
  const address = properties.name || properties.label || "";
  root.querySelector('[name="address"]').value = address;
  root.querySelector('[name="postcode"]').value = properties.postcode || "";
  root.querySelector('[name="city"]').value = properties.city || "";
  root.querySelector('[name="country"]').value = "France";
  root.querySelector('[name="longitude"]').value = coordinates[0] || "";
  root.querySelector('[name="latitude"]').value = coordinates[1] || "";
  root.querySelector('[name="addressLabel"]').value = properties.label || address;
  root.querySelector('[name="addressSelected"]').value = "1";
  const suggestions = root.querySelector(".address-suggestions");
  if (suggestions) suggestions.innerHTML = `<span>Adresse sélectionnée : ${escapeHtml(properties.label || address)}</span>`;
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
  const order = ["preparation", "livraison", "ecart_caisse", "devis_simple", "devis", "inventaire", "blocage", "litige", "rappel", "fournisseur", "instagram", "autre"];
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
    <label class="wide">Premier message<textarea name="notes" placeholder="Préparer dans un carton. Le client passe à 14h. Prévoir facture."></textarea></label>
    <button class="primary-action visible wide" type="submit">Valider</button>`;
}

function genericCreatorMarkup(assignee, defaults, type) {
  return `<label class="wide">Titre<input name="title" required placeholder="${MISSION_TYPES[type]?.label || "Nouvelle mission"}"></label>
    <label>Assigné à<select name="assignee">${members.map((member) => `<option ${member.name === assignee ? "selected" : ""}>${member.name}</option>`).join("")}</select></label>
    <label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>🔥 Urgente</option></select></label>
    <label>Date limite<input name="dueDate" type="date" value="${defaults.date}" required></label>
    <label>Heure limite<input name="dueTime" type="time" value="${defaults.time}" required></label>
    <label>Rappel automatique<select name="reminderMode"><option value="none">Aucun</option><option value="1h">Toutes les heures</option><option value="2h">Toutes les 2 heures</option><option value="4h">Toutes les 4 heures</option></select></label>
    ${isQuoteType(type) ? `<label>Client<input name="client" required placeholder="Nom du client"></label><label>Montant<input name="amount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00"></label><label>Date du devis<input name="quoteDate" type="date" value="${defaults.date}" required></label>` : ""}
    <label class="wide">Premier message<textarea name="notes" placeholder="Décrire la demande ou mentionner un collaborateur avec @"></textarea></label>
    <button class="primary-action visible wide" type="submit">Valider</button>`;
}

function isQuoteType(type) {
  return ["devis", "devis_simple"].includes(type);
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

function availableDeliveryOrders() {
  return state.tasks.filter((item) => item.missionType === "preparation" && !isDeleted(item) && ["Attribué", "En cours", "Prête", "Prête avec manquants"].includes(item.status));
}

function contactFullName(contact) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company || "Contact";
}

function openDeliveryCreator() {
  if (!requireIdentity()) return;
  const orders = availableDeliveryOrders();
  const defaults = defaultDeadline();
  el.taskDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">Livraison Stuart</p><h2>Nouvelle livraison</h2></div></header>
    <form class="task-form creator-form" id="deliveryForm">
      <label class="wide">Commande à livrer<select id="deliveryOrderSelect" name="orderId" required><option value="">Choisir une commande</option>${orders.map((order) => `<option value="${order.id}">${escapeHtml(order.title)}</option>`).join("")}</select></label>
      <section class="contact-autocomplete wide">
        <label>Destinataire<input id="deliveryContactSearch" type="search" placeholder="Avi, Rebibo, Neuilly, 06..." autocomplete="off"></label>
        <input id="deliveryContactId" name="contactId" type="hidden">
        <div class="contact-suggestions" id="deliveryContactSuggestions"></div>
      </section>
      <section class="stuart-form wide">
        <label>Titre<input id="deliveryTitle" name="title" required placeholder="Livraison Mr Benhamou"></label>
        <label>Assigné à<select name="assignee">${members.map((member) => `<option ${member.name === "Steven" ? "selected" : ""}>${member.name}</option>`).join("")}</select></label>
        <label>Priorité<select name="priority"><option>Normale</option><option>Haute</option><option>🔥 Urgente</option></select></label>
        <label>Date livraison<input name="dueDate" type="date" value="${defaults.date}" required></label>
        <label>Heure<input name="dueTime" type="time" value="${defaults.time}" required></label>
        <label>Statut<select name="status">${statusesForType("livraison").map((status) => `<option>${status}</option>`).join("")}</select></label>
        <label>Prénom<input name="firstName" data-contact-field="firstName"></label>
        <label>Nom<input name="lastName" data-contact-field="lastName"></label>
        <label>Entreprise<input name="company" data-contact-field="company"></label>
        <label>Téléphone<input name="phone" data-contact-field="phone" inputmode="tel"></label>
        <label class="wide address-smart">Adresse<input name="address" data-contact-field="address" data-address-input placeholder="42 rue des aca" autocomplete="off"><div class="address-suggestions"></div></label>
        <label>Complément<input name="address2" data-contact-field="address2"></label>
        <label>Code postal<input name="postcode" data-contact-field="postcode" inputmode="numeric"></label>
        <label>Ville<input name="city" data-contact-field="city"></label>
        <input name="country" data-contact-field="country" type="hidden">
        <input name="latitude" data-contact-field="latitude" type="hidden">
        <input name="longitude" data-contact-field="longitude" type="hidden">
        <input name="addressLabel" data-contact-field="addressLabel" type="hidden">
        <input name="addressSelected" data-contact-field="addressSelected" type="hidden">
        <label>Digicode<input name="accessCode" data-contact-field="accessCode"></label>
        <label>Étage<input name="floor" data-contact-field="floor"></label>
        <label>Ascenseur<select name="elevator" data-contact-field="elevator"><option value="">À préciser</option><option>Oui</option><option>Non</option></select></label>
        <label class="wide">Instructions livreur<textarea name="courierInstructions" data-contact-field="courierInstructions"></textarea></label>
        <section class="package-picker wide">
          <h3>Type de colis</h3>
          ${Object.entries(STUART_PACKAGES).map(([key, option], index) => `<label class="package-option"><input name="packageType" type="radio" value="${key}" ${index === 1 ? "checked" : ""} required><span><strong>${option.label}</strong><small>${option.detail}</small></span></label>`).join("")}
        </section>
        <section class="delivery-options wide">
          <label><input name="containsAlcohol" type="checkbox"> Contient de l'alcool</label>
          <label><input name="fragile" type="checkbox"> Fragile</label>
        </section>
        <label class="wide">Instructions supplémentaires<textarea name="extraInstructions" placeholder="Ex : remettre au gardien, appeler 5 min avant..."></textarea></label>
        <label class="wide">Premier message<textarea id="deliveryNotes" name="notes"></textarea></label>
      </section>
      <section class="delivery-order-preview wide" id="deliveryOrderPreview"></section>
      <button class="primary-action visible wide" type="submit">Valider la livraison</button>
    </form>`;
  document.querySelector("#deliveryOrderSelect").addEventListener("change", syncDeliveryOrderFields);
  bindDeliveryContactSearch();
  bindAddressAutocomplete(document.querySelector("#deliveryForm"));
  document.querySelector("#deliveryForm").addEventListener("submit", createDeliveryTask);
  el.taskDialog.showModal();
}

function syncDeliveryOrderFields() {
  const order = state.tasks.find((task) => task.id === document.querySelector("#deliveryOrderSelect").value);
  if (!order) return;
  document.querySelector("#deliveryTitle").value = `Livraison ${order.title}`;
  document.querySelector("#deliveryNotes").value = taskDiscussionPreview(order);
  document.querySelector("#deliveryOrderPreview").innerHTML = `<strong>Commande chargée</strong><span>${escapeHtml(order.status)} · assignée à ${escapeHtml(order.assignee)} par ${escapeHtml(order.createdBy)}</span>${order.products?.length ? `<div>${order.products.map((product) => `<small>${escapeHtml(product.name || "Produit")} · ${product.requested || 0}</small>`).join("")}</div>` : ""}`;
}

function bindDeliveryContactSearch() {
  const input = document.querySelector("#deliveryContactSearch");
  input.addEventListener("input", () => renderDeliveryContactSuggestions(input.value));
  renderDeliveryContactSuggestions("");
}

function renderDeliveryContactSuggestions(query) {
  const target = document.querySelector("#deliveryContactSuggestions");
  if (!target) return;
  const normalized = normalizeSearch(query);
  const contacts = activeContacts().filter((contact) => !normalized || contactSearchText(contact).includes(normalized)).slice(0, 5);
  target.innerHTML = `${contacts.map((contact) => `<button data-pick-contact="${contact.id}" type="button"><strong>${escapeHtml(contactFullName(contact))}</strong><span>${escapeHtml([contact.company, contact.city, contact.phone].filter(Boolean).join(" · "))}</span></button>`).join("")}<button class="create-contact-suggestion" id="quickCreateContact" type="button">+ Créer nouveau destinataire</button>`;
  target.querySelectorAll("[data-pick-contact]").forEach((button) => button.addEventListener("click", () => syncDeliveryContactFields(button.dataset.pickContact)));
  target.querySelector("#quickCreateContact").addEventListener("click", saveDeliveryContactFromForm);
}

function syncDeliveryContactFields(contactId) {
  const contact = state.addressBook.find((item) => item.id === contactId);
  if (!contact) return;
  document.querySelector("#deliveryContactId").value = contact.id;
  document.querySelector("#deliveryContactSearch").value = `${contactFullName(contact)}${contact.city ? ` · ${contact.city}` : ""}`;
  document.querySelectorAll("[data-contact-field]").forEach((input) => {
    input.value = contact[input.dataset.contactField] || "";
  });
  renderDeliveryContactSuggestions(document.querySelector("#deliveryContactSearch").value);
}

function saveDeliveryContactFromForm() {
  const formElement = document.querySelector("#deliveryForm");
  if (!formElement) return;
  const form = new FormData(formElement);
  const contact = contactFromForm(form);
  if (!contact.firstName && !contact.lastName && !contact.company) {
    showToast("Ajoutez au moins un nom ou une société");
    return;
  }
  upsertContact(contact);
  document.querySelector("#deliveryContactId").value = contact.id;
  document.querySelector("#deliveryContactSearch").value = `${contactFullName(contact)}${contact.city ? ` · ${contact.city}` : ""}`;
  addActivity(`${CURRENT_USER} a créé le destinataire ${contactFullName(contact)}`);
  renderDeliveryContactSuggestions(document.querySelector("#deliveryContactSearch").value);
  showToast("Destinataire ajouté au carnet");
}

function createDeliveryTask(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const order = state.tasks.find((task) => task.id === form.get("orderId"));
  if (!order) {
    hapticNotify("ERROR");
    showToast("Choisissez une commande à livrer");
    return;
  }
  const deliveryContact = {
    id: form.get("contactId") || "",
    firstName: form.get("firstName") || "",
    lastName: form.get("lastName") || "",
    company: form.get("company") || "",
    phone: form.get("phone") || "",
    address: form.get("address") || "",
    address2: form.get("address2") || "",
    postcode: form.get("postcode") || "",
    city: form.get("city") || "",
    country: form.get("country") || "France",
    latitude: form.get("latitude") || null,
    longitude: form.get("longitude") || null,
    addressLabel: form.get("addressLabel") || "",
    addressSelected: form.get("addressSelected") === "1",
    accessCode: form.get("accessCode") || "",
    floor: form.get("floor") || "",
    elevator: form.get("elevator") || "",
    courierInstructions: form.get("courierInstructions") || ""
  };
  const packageType = form.get("packageType") || "small";
  const extraInstructions = form.get("extraInstructions") || "";
  const deliveryOptions = {
    containsAlcohol: form.get("containsAlcohol") === "on",
    fragile: form.get("fragile") === "on"
  };
  const assignee = form.get("assignee") || "Steven";
  const taskId = `task-${Date.now()}`;
  const createdAt = Date.now();
  const item = {
    id: taskId,
    title: form.get("title"),
    missionType: "livraison",
    linkedOrderId: order.id,
    linkedOrderTitle: order.title,
    products: normalizeProducts(order),
    deliveryContact,
    packageType,
    packageSize: STUART_PACKAGES[packageType]?.detail || STUART_PACKAGES.small.detail,
    deliveryOptions,
    extraInstructions,
    assignee,
    assignedTo: assignee,
    createdBy: CURRENT_USER,
    assignedBy: CURRENT_USER,
    priority: form.get("priority"),
    dueDate: form.get("dueDate"),
    dueTime: form.get("dueTime"),
    due: formatDeadline(form.get("dueDate"), form.get("dueTime")),
    notes: "",
    status: form.get("status") || "Créée",
    reminderMode: "none",
    reminderEnabled: false,
    lastReminderAt: null,
    createdAt,
    seenBy: [],
    messages: initialTaskMessages(taskId, CURRENT_USER, form.get("notes"), createdAt),
    history: [`Livraison créée par ${CURRENT_USER} — ${dateTimeNow()}`, `Commande liée : ${order.title} — ${dateTimeNow()}`]
  };
  if (item.messages.length) item.history.push(`Premier message ajouté par ${CURRENT_USER} — ${dateTimeNow()}`);
  state.tasks.unshift(item);
  addActivity(`${CURRENT_USER} a créé une livraison Stuart pour ${order.title}`);
  save(item);
  render();
  openTask(item.id);
  sendPush(assignee, "Nouvelle livraison", `${CURRENT_USER} vous a assigné : ${item.title}`, taskDeepLink(item.id), `task:${item.id}:delivery-created`);
  hapticNotify("SUCCESS");
  showToast("Livraison créée");
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
  const taskId = `task-${Date.now()}`;
  const createdAt = Date.now();
  const messages = initialTaskMessages(taskId, CURRENT_USER, form.get("notes"), createdAt);
  const item = { id: taskId, title: form.get("title"), missionType, assignee: assignedTo, createdBy: CURRENT_USER, assignedTo, assignedBy: CURRENT_USER, priority: form.get("priority"), dueDate: form.get("dueDate"), dueTime: form.get("dueTime"), due: formatDeadline(form.get("dueDate"), form.get("dueTime")), notes: "", requested, available, products, client: form.get("client") || "", amount: Number(form.get("amount") || 0), quoteDate: form.get("quoteDate") || "", status: statusesForType(missionType)[0], reminderMode, reminderEnabled: reminderMode !== "none", lastReminderAt: null, createdAt, seenBy: [], messages, history: [`Créée par ${CURRENT_USER} — ${dateTimeNow()}`] };
  if (messages.length) item.history.push(`Premier message ajouté par ${CURRENT_USER} — ${dateTimeNow()}`);
  if (products.length) {
    item.history.push(`Produits ajoutés : ${products.map((product) => `${product.name || "Produit"} (${product.requested})`).join(", ")} — ${dateTimeNow()}`);
  }
  state.tasks.unshift(item);
  addActivity(`${CURRENT_USER} a créé ${item.title} pour ${assignedTo}`);
  if (missingQuantity(item)) addActivity(`⚠️ ${item.title} : manquant ${missingQuantity(item)}`);
  save(item); render();
  openTask(item.id);
  hapticNotify("SUCCESS");
  const pushTitle = item.missionType === "livraison" ? "Nouvelle livraison" : item.priority.includes("Urgente") ? "🔥 Nouvelle tâche urgente" : "Nouvelle tâche Winess Hub";
  const pushBody = item.missionType === "preparation" ? `${CURRENT_USER} vous a assigné une préparation de commande : ${item.title}` : `${CURRENT_USER} vous a assigné une nouvelle tâche : ${item.title}`;
  sendPush(assignedTo, pushTitle, pushBody, taskDeepLink(item.id), `task:${item.id}:assigned`);
}

function openTask(id, messageId = "", options = {}) {
  if (!requireIdentity()) return;
  let item = state.tasks.find((task) => task.id === id);
  if (!item) return;
  if (location.hash.startsWith("#view-")) lastViewHash = location.hash;
  openedTaskId = id;
  pendingMessageId = messageId;
  rememberLastOpenedTask(item, messageId);
  if (options.updateRoute !== false) setTaskRoute(id, messageId);
  if (!item.seenBy.some((seen) => seen.user === CURRENT_USER)) {
    item.seenBy.push({ user: CURRENT_USER, date: dateNow(), time: timeNow() });
    item.history.push(`👁 Vu par ${CURRENT_USER} — ${dateTimeNow()}`);
    addActivity(`${CURRENT_USER} a vu ${item.title}`);
    save(item); render();
    item = state.tasks.find((task) => task.id === id);
  }
  markDiscussionRead(item);
  el.taskDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">${typeLabel(item)}</p><h2 id="taskTitleDisplay">${escapeHtml(item.title)}</h2><div class="title-actions">${isDeleted(item) ? "" : `<button id="editTaskTitle" type="button">✏️ Modifier le titre</button>`}</div><p class="assignment-line">Mission assignée à ${item.assignee} par ${item.createdBy} <button class="whatsapp-share" id="shareTask" type="button">WhatsApp</button></p></div></header>
    <section class="title-editor" id="taskTitleEditor" hidden><label>Nouveau titre<input id="taskTitleInput" value="${escapeHtml(item.title)}" maxlength="160"></label></section>
    <section class="assignment-summary"><article><span>Assigné par</span><strong>${item.createdBy}</strong></article><article><span>Assigné à</span><strong>${item.assignee}</strong></article></section>
    <section class="task-detail-grid"><article><span>Statut</span><strong>${isDeleted(item) ? "Supprimée" : item.status}</strong></article><article><span>Priorité</span><strong>${item.priority}</strong></article><article><span>Date limite</span><strong>${formatDue(item)}</strong></article><article><span>Créée</span><strong>${new Date(item.createdAt).toLocaleString("fr-FR")}</strong></article></section>
    ${completionDatesMarkup(item)}
    ${isQuoteType(item.missionType) ? `<section class="quantity-status"><article><span>Client</span><strong>${item.client || "À préciser"}</strong></article><article><span>Montant</span><strong>${formatAmount(item.amount)}</strong></article><article><span>Date du devis</span><strong>${formatDate(item.quoteDate)}</strong></article></section>` : ""}
    ${item.missionType === "livraison" ? deliveryDetailMarkup(item) : ""}
    ${item.missionType !== "preparation" && (item.requested || item.available) ? `<section class="quantity-status"><article><span>Demandé</span><strong>${item.requested || 0}</strong></article><article><span>Disponible</span><strong>${item.available || 0}</strong></article><article class="${missingQuantity(item) ? "has-missing" : ""}"><span>Manquant</span><strong>${missingQuantity(item)}</strong></article></section>` : ""}
    ${missingQuantity(item) ? `<section class="missing-banner">⚠️ Produit manquant : ${missingQuantity(item)}</section>` : ""}
    ${item.missionType === "preparation" ? preparationDetailMarkup(item) : ""}
    <section class="read-status"><h3>Vu par</h3>${item.seenBy.map((seen) => `<p>👁 Vu par ${seen.user} — ${seen.date || dateNow()} ${seen.time}</p>`).join("") || `<p>Pas encore vue</p>`}</section>
    ${item.reminderEnabled ? `<section class="auto-reminder-state">Rappel auto ${reminderLabel(item.reminderMode)} activé${item.lastReminderAt ? ` · dernier envoi ${new Date(item.lastReminderAt).toLocaleString("fr-FR")}` : ""}</section>` : ""}
    ${discussionMarkup(item)}
    <section class="task-form single"><div class="quantity-edit"><label>Date limite<input id="taskDueDate" type="date" value="${item.dueDate || ""}" ${isDeleted(item) ? "disabled" : ""}></label><label>Heure limite<input id="taskDueTime" type="time" value="${item.dueTime || ""}" ${isDeleted(item) ? "disabled" : ""}></label></div>${item.missionType !== "preparation" ? `<div class="quantity-edit"><label>Demandé<input id="taskRequested" type="number" min="0" value="${item.requested || 0}" ${isDeleted(item) ? "disabled" : ""}></label><label>Disponible<input id="taskAvailable" type="number" min="0" value="${item.available || 0}" ${isDeleted(item) ? "disabled" : ""}></label></div>` : ""}${isQuoteType(item.missionType) ? `<div class="quantity-edit"><label>Client<input id="taskClient" value="${item.client || ""}"></label><label>Montant<input id="taskAmount" type="number" min="0" step="0.01" value="${item.amount || 0}"></label></div><label>Date du devis<input id="taskQuoteDate" type="date" value="${item.quoteDate || ""}"></label>` : ""}<label>Statut<select id="taskStatus" ${isDeleted(item) ? "disabled" : ""}>${statusesFor(item).map((status) => `<option ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}</select></label><label>Rappel automatique<select id="taskReminderMode" ${isDeleted(item) || isCompleted(item) ? "disabled" : ""}><option value="none" ${item.reminderMode === "none" ? "selected" : ""}>Aucun rappel</option><option value="1h" ${item.reminderMode === "1h" ? "selected" : ""}>Toutes les heures</option><option value="2h" ${item.reminderMode === "2h" ? "selected" : ""}>Toutes les 2h</option><option value="4h" ${item.reminderMode === "4h" ? "selected" : ""}>Toutes les 4h</option></select></label></section>
    <div class="task-form-actions">${isDeleted(item) ? "" : `<button id="saveTask" type="button">Valider</button>${!isCompleted(item) ? `<button id="validateTask" class="complete-action" type="button">✅ Valider la tâche</button>` : ""}${!isCompleted(item) && item.createdBy === CURRENT_USER ? `<button id="remindTask" type="button">Relancer</button>` : ""}<button id="deleteTask" class="danger-action" type="button">Supprimer</button>`}<button id="shareTaskBottom" class="whatsapp-action" type="button">Partager WhatsApp</button></div>
    ${statusAuditMarkup(item)}
    <details class="task-history"><summary>Historique</summary>${item.history.map((line) => `<p>${line}</p>`).join("")}</details>`;
  document.querySelector("#saveTask")?.addEventListener("click", () => saveTaskDetails(item));
  document.querySelector("#editTaskTitle")?.addEventListener("click", () => {
    const editor = document.querySelector("#taskTitleEditor");
    editor.hidden = false;
    document.querySelector("#taskTitleInput").focus();
  });
  document.querySelector("#shareTask").addEventListener("click", () => shareTask(item));
  document.querySelector("#shareTaskBottom").addEventListener("click", () => shareTask(item));
  document.querySelector("#quoteStuart")?.addEventListener("click", () => calculateStuartQuote(item, false));
  document.querySelector("#simulateStuart")?.addEventListener("click", () => createStuartDelivery(item, false));
  document.querySelector("#testStuart")?.addEventListener("click", () => createStuartDelivery(item, true));
  document.querySelector("#modifyStuartQuote")?.addEventListener("click", () => clearStuartQuote(item));
  document.querySelector("#refreshStuart")?.addEventListener("click", () => refreshStuartStatus(item, true));
  document.querySelectorAll("[data-product-check]").forEach((input) => input.addEventListener("change", () => toggleProductPrepared(item, input.dataset.productCheck, input.checked)));
  document.querySelector("#finishPreparation")?.addEventListener("click", () => finishPreparation(item));
  document.querySelector("#validateTask")?.addEventListener("click", () => validateTask(item));
  document.querySelector("#remindTask")?.addEventListener("click", () => remindTask(item.id));
  document.querySelector("#deleteTask")?.addEventListener("click", () => deleteTask(item));
  bindDiscussion(item);
  if (!el.taskDialog.open) el.taskDialog.showModal();
  focusDiscussionMessage(messageId);
}

function validateTask(item) {
  const statusSelect = document.querySelector("#taskStatus");
  if (statusSelect) statusSelect.value = "Validé";
  saveTaskDetails(item);
}

function deliveryDetailMarkup(item) {
  const contact = item.deliveryContact || {};
  const address = [contact.address, contact.address2, contact.postcode, contact.city].filter(Boolean).join(", ") || "Adresse à préciser";
  return `<section class="delivery-panel">
    <header><h3>Livraison Stuart</h3><span>${escapeHtml(item.status)}</span></header>
    <div class="delivery-grid">
      <article><span>Commande</span><strong>${escapeHtml(item.linkedOrderTitle || "Non liée")}</strong></article>
      <article><span>Destinataire</span><strong>${escapeHtml([contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company || "À préciser")}</strong></article>
      <article><span>Téléphone</span><strong>${escapeHtml(contact.phone || "À préciser")}</strong></article>
      <article><span>Adresse</span><strong>${escapeHtml(address)}</strong></article>
      <article><span>Digicode</span><strong>${escapeHtml(contact.accessCode || "À préciser")}</strong></article>
      <article><span>Étage</span><strong>${escapeHtml(contact.floor || "À préciser")}</strong></article>
      <article><span>Ascenseur</span><strong>${escapeHtml(contact.elevator || "À préciser")}</strong></article>
      <article><span>Instructions</span><strong>${escapeHtml(contact.courierInstructions || "Aucune")}</strong></article>
      <article><span>Colis</span><strong>${escapeHtml(packageLabel(item))}</strong></article>
      <article><span>Options</span><strong>${escapeHtml(deliveryOptionLabel(item))}</strong></article>
    </div>
    ${item.products?.length ? `<div class="delivery-products"><strong>Produits</strong>${item.products.map((product) => `<small>${escapeHtml(product.name || "Produit")} · ${product.requested || 0}</small>`).join("")}</div>` : ""}
    ${stuartTrackingMarkup(item)}
    ${stuartQuoteMarkup(item)}
    ${item.stuartError ? `<div class="missing-banner">Erreur Stuart : ${escapeHtml(item.stuartError)}</div>` : ""}
    ${!isCompleted(item) && !item.stuartJobRequestedAt ? stuartActionMarkup(item) : item.stuartJobRequestedAt ? `<div class="stuart-actions"><button id="refreshStuart" class="secondary-action visible" type="button">Actualiser Stuart</button></div><div class="available-banner">Livraison Stuart demandée · ${new Date(item.stuartJobRequestedAt).toLocaleString("fr-FR")}</div>` : ""}
  </section>`;
}

function stuartActionMarkup(item) {
  if (item.stuartQuote) {
    return `<div class="stuart-actions"><button id="simulateStuart" class="primary-action visible" type="button">🟢 Créer la livraison</button><button id="modifyStuartQuote" class="secondary-action visible" type="button">⚪ Modifier</button></div>`;
  }
  return `<div class="stuart-actions"><button id="quoteStuart" class="primary-action visible" type="button">Calculer le tarif Stuart</button><button id="testStuart" class="secondary-action visible" type="button">Mode Test</button></div>`;
}

function stuartQuoteMarkup(item) {
  if (!item.stuartQuote) return "";
  return `<section class="stuart-quote">
    <strong>🚚 Livraison Stuart</strong>
    <span>💶 Prix estimé : ${formatStuartPrice(item.stuartQuote)}</span>
    <span>🕒 Temps estimé : ${formatStuartDuration(item.stuartQuote)}</span>
  </section>`;
}

function formatStuartPrice(quote = {}) {
  const amount = Number(quote.amount ?? quote.price ?? quote.total ?? quote.amountInCents / 100);
  const currency = quote.currency || "EUR";
  if (!Number.isFinite(amount)) return "À confirmer";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

function formatStuartDuration(quote = {}) {
  const minutes = Number(quote.duration ?? quote.eta ?? quote.estimated_duration ?? quote.durationInMinutes);
  if (!Number.isFinite(minutes)) return "À confirmer";
  return `${Math.round(minutes)} min`;
}

function buildStuartPayload(item, testMode = false) {
  const scheduledAt = item.dueDate ? new Date(`${item.dueDate}T${item.dueTime || "12:00"}`).toISOString() : null;
  return {
    task_id: item.id,
    title: item.title,
    linked_order_id: item.linkedOrderId || "",
    linked_order_title: item.linkedOrderTitle || "",
    client_reference: item.linkedOrderId || item.id,
    scheduled_at: scheduledAt,
    delivery_contact: item.deliveryContact || {},
    products: normalizeProducts(item),
    package_type: STUART_PACKAGES[item.packageType]?.api || item.packageType || "small",
    package_size: item.packageSize || STUART_PACKAGES[item.packageType]?.detail || "",
    contains_alcohol: Boolean(item.deliveryOptions?.containsAlcohol),
    fragile: Boolean(item.deliveryOptions?.fragile),
    extra_instructions: item.extraInstructions || "",
    package_description: normalizeProducts(item).map((product) => `${product.name || "Produit"} x${product.requested || 1}`).join(", ") || item.title,
    test_mode: testMode
  };
}

async function calculateStuartQuote(item, testMode = false) {
  const button = document.querySelector("#quoteStuart");
  if (button) {
    button.disabled = true;
    button.textContent = "Calcul en cours...";
  }
  try {
    validateStuartContact(item.deliveryContact || {});
    const response = await callEdgeFunction("stuart-api", {
      action: "quote-delivery",
      task_id: item.id,
      created_by: memberIdForName(CURRENT_USER || "system"),
      payload: buildStuartPayload(item, testMode)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "Impossible de calculer le tarif Stuart.");
    item.stuartQuote = extractStuartQuote(result.data);
    item.stuartQuoteAt = new Date().toISOString();
    item.stuartError = "";
    item.history.push(`Tarif Stuart calculé : ${formatStuartPrice(item.stuartQuote)} · ${formatStuartDuration(item.stuartQuote)} — ${dateTimeNow()}`);
    save(item);
    render();
    openTask(item.id);
    showToast("Tarif Stuart calculé");
  } catch (error) {
    item.stuartError = error.message || "Impossible de calculer le tarif Stuart.";
    item.history.push(`Erreur tarif Stuart : ${item.stuartError} — ${dateTimeNow()}`);
    save(item);
    render();
    openTask(item.id);
    showToast(item.stuartError);
  }
}

function extractStuartQuote(data) {
  const source = data?.pricing || data?.price || data?.quote || data?.job || data?.data || data || {};
  const amount = source.amount ?? source.total ?? source.price ?? source.amount_cents / 100 ?? source.amountInCents / 100;
  const duration = source.duration ?? source.eta ?? source.estimated_duration ?? source.estimatedDuration ?? source.duration_min ?? source.durationInMinutes;
  return {
    amount,
    currency: source.currency || source.currency_code || "EUR",
    duration,
    raw: data
  };
}

function clearStuartQuote(item) {
  item.stuartQuote = null;
  item.stuartQuoteAt = null;
  item.stuartError = "";
  save(item);
  render();
  openTask(item.id);
  showToast("Tarif réinitialisé");
}

async function createStuartDelivery(item, testMode = false) {
  if (isCompleted(item)) {
    recordLockedStatusAttempt(item, "create-stuart", item.status, "Course demandée");
    save(item);
    hapticNotify("ERROR");
    showToast("Tâche terminée : création Stuart refusée");
    return;
  }
  const previousStatus = item.status;
  const button = document.querySelector(testMode ? "#testStuart" : "#simulateStuart");
  if (button) {
    button.disabled = true;
    button.textContent = testMode ? "Test en cours..." : "Création Stuart...";
  }
  try {
    if (!testMode) {
      validateStuartContact(item.deliveryContact || {});
      if (!item.stuartQuote) throw new Error("Calculez le tarif Stuart avant de créer la livraison.");
    }
    const response = await callEdgeFunction("stuart-api", {
      action: "create-delivery",
      task_id: item.id,
      created_by: memberIdForName(CURRENT_USER || "system"),
      payload: buildStuartPayload(item, testMode)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "Erreur Stuart");
    const course = extractStuartCourse(result.data);

    item.status = "Course demandée";
    item.stuartJobRequestedAt = new Date().toISOString();
    item.stuartJob = result.data || null;
    item.stuartJobId = course.id;
    item.stuartStatus = course.status || item.status;
    item.stuartCreatedAt = course.createdAt || item.stuartJobRequestedAt;
    item.stuartLastSyncAt = course.updatedAt || item.stuartJobRequestedAt;
    item.stuartEta = course.eta || "";
    item.stuartTrackingUrl = course.trackingUrl;
    item.stuartTestMode = Boolean(course.testMode || testMode);
    item.stuartError = "";
    appendStuartTimeline(item, "Course demandée", item.stuartJobRequestedAt);
    item.history.push(`${testMode ? "Livraison Stuart TEST créée" : "Livraison Stuart créée"} par ${CURRENT_USER}${course.id ? ` · ID ${course.id}` : ""} — ${dateTimeNow()}`);
    recordStatusActivity(item, item.status, previousStatus);
    save(item);
    render();
    openTask(item.id, pendingMessageId, { updateRoute: false });
    hapticNotify("SUCCESS");
    showToast(testMode ? "Livraison test créée" : "Livraison Stuart demandée");
  } catch (error) {
    console.warn("Stuart indisponible", error);
    item.stuartError = error.message || "création refusée";
    item.history.push(`Erreur Stuart : ${item.stuartError} — ${dateTimeNow()}`);
    save(item);
    hapticNotify("ERROR");
    showToast(`Erreur Stuart : ${item.stuartError}`);
    openTask(item.id);
  }
}

function packageLabel(item) {
  const pack = STUART_PACKAGES[item.packageType] || STUART_PACKAGES.small;
  return `${pack.label} · ${item.packageSize || pack.detail}`;
}

function deliveryOptionLabel(item) {
  const labels = [];
  if (item.deliveryOptions?.containsAlcohol) labels.push("Alcool");
  if (item.deliveryOptions?.fragile) labels.push("Fragile");
  return labels.join(" · ") || "Aucune";
}

function validateStuartContact(contact) {
  if (!contact.phone) throw new Error("Téléphone manquant pour créer la livraison Stuart.");
  if (!contact.address) throw new Error("Adresse incomplète.");
  if (!contact.postcode) throw new Error("Code postal manquant.");
  if (!contact.city) throw new Error("Ville manquante.");
  if (!contact.addressSelected && !contact.latitude && !contact.longitude) throw new Error("Sélectionnez une adresse proposée pour éviter une erreur Stuart.");
}

function extractStuartCourse(data) {
  const job = data?.job || data?.data || data || {};
  const delivery = Array.isArray(job.deliveries) ? job.deliveries[0] || {} : {};
  return {
    id: job.id || job.job_id || job.uuid || "",
    status: job.status || job.state || "",
    createdAt: job.created_at || job.createdAt || "",
    updatedAt: job.updated_at || job.updatedAt || delivery.updated_at || delivery.updatedAt || "",
    eta: job.eta || job.estimated_arrival || job.estimatedArrival || job.dropoff_eta || delivery.eta || delivery.estimated_arrival || delivery.estimatedArrival || "",
    trackingUrl: job.tracking_url || job.trackingUrl || job.tracking?.url || job.public_tracking_url || delivery.tracking_url || "",
    testMode: Boolean(job.test_mode || data?.test_mode)
  };
}

function mapStuartStatus(status = "") {
  const value = normalizeSearch(status).replace(/[_-]/g, " ");
  if (value.includes("incident") || value.includes("failed") || value.includes("problem")) return "Incident";
  if (value.includes("cancel")) return "Annulée";
  if (value.includes("delivered") || value.includes("completed") || value.includes("finished") || value.includes("livree") || value.includes("terminee")) return "Terminée";
  if (value.includes("at dropoff") || value.includes("arrived at dropoff") || value.includes("client")) return "Arrivé client";
  if (value.includes("delivering") || value.includes("dropoff") || value.includes("en livraison")) return "En livraison";
  if (value.includes("picked") || value.includes("pickup complete") || value.includes("recup")) return "Commande récupérée";
  if (value.includes("arriv") || value.includes("courier at pickup")) return "Coursier arrivé";
  if (value.includes("going") || value.includes("courier") || value.includes("accepted")) return "Coursier accepté";
  if (value.includes("search") || value.includes("created") || value.includes("pending") || value.includes("test")) return "Course demandée";
  return status || "Course demandée";
}

function stuartDisplayStatus(item) {
  const status = item.stuartStatus || item.status || "";
  const mapped = mapStuartStatus(status);
  const icons = {
    "Course demandée": "🟡 Recherche d'un coursier",
    "Coursier accepté": "🟢 Coursier accepté",
    "Coursier arrivé": "🟠 En route vers la boutique",
    "Commande récupérée": "🔵 Commande récupérée",
    "En livraison": "🟣 En livraison",
    "Arrivé client": "📍 Arrivé chez le client",
    "Livrée": "✅ Livrée",
    "Terminée": "✅ Terminée",
    "Annulée": "❌ Annulée",
    "Incident": "⚠️ Incident"
  };
  return icons[mapped] || mapped;
}

async function refreshStuartStatus(item, manual = false) {
  if (!item.stuartJobId || item.stuartTestMode) {
    if (manual) showToast(item.stuartTestMode ? "Mode Test : pas de suivi réel" : "Aucune course Stuart");
    return;
  }
  try {
    const response = await callEdgeFunction("stuart-api", {
      action: "get-delivery",
      task_id: item.id,
      created_by: memberIdForName(CURRENT_USER || "system"),
      payload: { job_id: item.stuartJobId }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "Suivi Stuart indisponible");
    const course = extractStuartCourse(result.data);
    const nextStatus = mapStuartStatus(course.status);
    const previousStatus = item.status;
    item.stuartStatus = course.status || item.stuartStatus;
    item.stuartLastSyncAt = course.updatedAt || new Date().toISOString();
    item.stuartEta = course.eta || item.stuartEta || "";
    item.stuartTrackingUrl = course.trackingUrl || item.stuartTrackingUrl;
    if (nextStatus && nextStatus !== item.status) {
      const finalByStuart = nextStatus === "Terminée";
      if (isCompleted(item) && !isCompletedStatus(nextStatus)) {
        recordLockedStatusAttempt(item, "frontend-poll-stuart", item.status, nextStatus);
      } else {
        item.status = finalByStuart ? "Terminée" : nextStatus;
        appendStuartTimeline(item, finalByStuart ? "Livrée" : nextStatus, item.stuartLastSyncAt);
        item.history.push(`Statut Stuart : ${stuartDisplayStatus(item)} — ${dateTimeNow()}`);
        if (finalByStuart) {
          item.history.push(`Livraison confirmée automatiquement par Stuart. — ${dateTimeNow()}`);
          item.history.push(`Tâche clôturée automatiquement. — ${dateTimeNow()}`);
        }
        recordStatusActivity(item, item.status, previousStatus, "frontend-poll-stuart");
        notifyStuart(item, nextStatus);
      }
    }
    item.stuartError = "";
    save(item);
    render();
    if (manual) showToast("Statut Stuart actualisé");
  } catch (error) {
    item.stuartError = error.message || "Suivi Stuart indisponible";
    save(item);
    if (manual) {
      render();
      showToast(`Erreur Stuart : ${item.stuartError}`);
    }
  }
}

function notifyStuart(item, event) {
  const contact = item.deliveryContact || {};
  const recipient = contactFullName(contact);
  const eta = item.stuartEta || item.stuartEstimatedArrival || "";
  const normalizedEvent = normalizeSearch(event);
  const isLate = normalizedEvent.includes("retard") || normalizedEvent.includes("delay") || normalizedEvent.includes("late");
  const isIncident = normalizedEvent.includes("incident") || normalizedEvent.includes("failed") || normalizedEvent.includes("problem");
  const notifications = {
    "Terminée": ["✅ Livraison Stuart terminée", `Client : ${recipient}\nLa tâche a été clôturée automatiquement.`],
    "Annulée": ["❌ Livraison annulée", "La course Stuart a été annulée."],
    incident: ["⚠️ Incident livraison", "Vérifier la course Stuart."],
    late: ["⏰ Retard livraison", eta ? `Retard important détecté. ETA : ${eta}.` : "Retard important détecté sur la course Stuart."]
  };
  const notification = notifications[event] || (isIncident ? notifications.incident : isLate ? notifications.late : null);
  if (!notification) return;
  const [title, body] = notification;
  sendPush(item.createdBy, title, body, taskDeepLink(item.id), `stuart:${item.id}:${event}:${item.stuartStatus || item.status}`);
}

function stuartTrackingMarkup(item) {
  if (!item.stuartJobId && !item.stuartStatus && !item.stuartTrackingUrl) return "";
  const timeline = stuartTimelineEntries(item);
  return `<section class="stuart-tracking">
    <header>
      <div><strong>🚚 Suivi Stuart</strong><span>${escapeHtml(item.stuartJobId || "Course en attente")}</span></div>
      ${item.stuartTrackingUrl ? `<a href="${escapeHtml(item.stuartTrackingUrl)}" target="_blank" rel="noopener">Suivi</a>` : ""}
    </header>
    <div class="stuart-status-grid">
      <article><span>Statut actuel</span><strong>${escapeHtml(stuartDisplayStatus(item))}</strong></article>
      <article><span>ETA</span><strong>${escapeHtml(formatStuartEta(item.stuartEta))}</strong></article>
      <article><span>Dernière mise à jour</span><strong>${formatStuartDate(item.stuartLastSyncAt || item.updatedAt)}</strong></article>
      <article><span>Créée</span><strong>${formatStuartDate(item.stuartCreatedAt)}</strong></article>
      ${item.stuartTestMode ? `<article><span>Mode</span><strong>Test</strong></article>` : ""}
    </div>
    <div class="stuart-timeline">
      ${timeline.map((entry) => `<div class="stuart-step ${entry.done ? "is-done" : ""}">
        <span>${escapeHtml(entry.icon)}</span>
        <strong>${escapeHtml(entry.label)}</strong>
        <small>${escapeHtml(entry.time || "En attente")}</small>
      </div>`).join("")}
    </div>
  </section>`;
}

function appendStuartTimeline(item, status, when = "") {
  const mapped = mapStuartStatus(status);
  const key = normalizedStatusKey(mapped);
  const timestamp = when || new Date().toISOString();
  const timeline = Array.isArray(item.stuartTimeline) ? item.stuartTimeline : [];
  if (!timeline.some((entry) => entry?.key === key)) item.stuartTimeline = [...timeline, { key, status: mapped, at: timestamp }];
}

function stuartTimelineEntries(item) {
  const saved = Array.isArray(item.stuartTimeline) ? item.stuartTimeline : [];
  const byKey = new Map(saved.map((entry) => [entry?.key || normalizedStatusKey(entry?.status), entry]));
  return [
    ["Course demandée", "✅", "Course créée"],
    ["Coursier accepté", "🛵", "Coursier accepté"],
    ["Coursier arrivé", "🏪", "Arrivé chez Winess"],
    ["Commande récupérée", "📦", "Colis récupéré"],
    ["En livraison", "🚗", "En route vers le client"],
    ["Arrivé client", "📍", "Arrivé chez le client"],
    ["Livrée", "✅", "Livraison effectuée"]
  ].map(([status, icon, label]) => {
    const key = normalizedStatusKey(status);
    const entry = byKey.get(key);
    return { icon, label, done: Boolean(entry), time: entry?.at ? formatStuartDate(entry.at) : "" };
  });
}

function formatStuartEta(value) {
  if (!value) return "À venir";
  const number = Number(value);
  if (Number.isFinite(number)) return `${Math.round(number)} min`;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return String(value);
}

function formatStuartDate(value) {
  if (!value) return "À venir";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
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
  openTask(item.id, pendingMessageId, { updateRoute: false });
  hapticNotify("SUCCESS");
  showToast(everythingAvailable ? "Préparation prête" : "Préparation prête avec manquants");
}

function saveTaskDetails(item) {
  const previousStatus = item.status;
  const previousMissing = missingQuantity(item);
  const previousTitle = item.title;
  const nextTitle = document.querySelector("#taskTitleInput")?.value.trim();
  if (nextTitle) item.title = nextTitle;
  const dueDate = document.querySelector("#taskDueDate").value;
  const dueTime = document.querySelector("#taskDueTime").value;
  if (dueDate) {
    item.dueDate = dueDate;
    item.dueTime = dueTime;
    item.due = formatDeadline(dueDate, dueTime);
  }
  item.requested = document.querySelector("#taskRequested") ? Number(document.querySelector("#taskRequested").value || 0) : (item.products || []).reduce((total, product) => total + Number(product.requested || 0), 0);
  item.available = document.querySelector("#taskAvailable") ? Number(document.querySelector("#taskAvailable").value || 0) : (item.products || []).reduce((total, product) => total + Number(product.available || 0), 0);
  if (isQuoteType(item.missionType)) {
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
  }
  save(item); render(); openTask(item.id, pendingMessageId, { updateRoute: false });
  if (isCompleted(item)) hapticNotify("SUCCESS");
  else hapticImpact("LIGHT");
  showToast(isCompleted(item) ? "Tâche déplacée dans les archives" : "Modifications enregistrées");
}

function recordStatusActivity(item, status, previousStatus = "", source = "frontend-user") {
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
  const changedAt = new Date().toISOString();
  item.statusChangedAt = changedAt;
  item.statusChangeSource = source;
  item.statusChangedBy = source === "frontend-user" ? CURRENT_USER : source;
  item.statusChangedDevice = DEVICE_ID;
  if (source === "frontend-user" && isCompletedStatus(previousStatus) && !isCompletedStatus(status)) {
    item.statusOverrideAt = changedAt;
    item.statusOverrideBy = CURRENT_USER;
  }
  appendStatusAudit(item, { source, previousStatus, nextStatus: status, outcome: "acceptée", at: changedAt });
  item.history.push(`${status} par ${CURRENT_USER} — ${dateTimeNow()}`);
  addActivity(`${CURRENT_USER} ${wording}`);
  if (item.missionType === "livraison" && item.stuartJobId) return;
  const eventId = `task:${item.id}:status:${status}`;
  if (status === "Livré") sendPush(item.createdBy, "Livraison livrée", `${item.title} a été livrée`, taskDeepLink(item.id), eventId);
  if (isCompleted(item) && !["Prête", "Prête avec manquants", "Récupérée", "Livré"].includes(status)) sendPush(item.createdBy, "Tâche terminée", `${CURRENT_USER} a validé la tâche : ${item.title}`, taskDeepLink(item.id), eventId);
}

function recordLockedStatusAttempt(item, source, previousStatus, nextStatus) {
  const at = new Date().toISOString();
  appendStatusAudit(item, { source, previousStatus, nextStatus, outcome: "refusée (statut verrouillé)", at });
  item.history.push(`${source} — tentative ${previousStatus} → ${nextStatus} refusée (statut verrouillé) — ${dateTimeNow()}`);
}

function appendStatusAudit(item, entry) {
  item.statusAudit ||= [];
  item.statusAudit.push({
    at: entry.at,
    source: entry.source,
    deviceId: DEVICE_ID,
    user: CURRENT_USER || "system",
    previousStatus: entry.previousStatus,
    nextStatus: entry.nextStatus,
    outcome: entry.outcome
  });
  item.statusAudit = item.statusAudit.slice(-100);
}

function statusAuditMarkup(item) {
  const entries = item.statusAudit || [];
  if (!entries.length) return "";
  return `<details class="task-history status-audit"><summary>Journal des statuts</summary>${entries.slice().reverse().map((entry) => `<p><strong>${formatAuditDate(entry.at)}</strong> · ${escapeHtml(entry.source || "inconnu")} · ${escapeHtml(entry.previousStatus || "—")} → ${escapeHtml(entry.nextStatus || "—")} · ${escapeHtml(entry.outcome || "")}</p>`).join("")}</details>`;
}

function formatAuditDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function shareTask(item) {
  const url = `${APP_BASE_URL}index.html?v=${APP_VERSION}#task-${item.id}`;
  const text = `Mission : ${item.title}\nAssigné à : ${item.assignee}\nAssigné par : ${item.createdBy}\nStatut : ${item.status}\nPriorité : ${item.priority}\nDate limite : ${formatDue(item)}\nDiscussion : ${taskDiscussionPreview(item) || "Aucun message"}\nLien : ${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const opened = window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  if (!opened) location.href = whatsappUrl;
}

function messageRecord(taskId, author, content, createdAt = Date.now(), id = "") {
  const text = String(content || "").trim();
  return {
    id: id || crypto.randomUUID?.() || `message-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    taskId,
    author,
    authorId: memberIdForName(author),
    content: text,
    mentions: extractMentions(text),
    createdAt: new Date(createdAt || Date.now()).toISOString(),
    readBy: [{ user: author, userId: memberIdForName(author), time: timeNow(), at: new Date(createdAt || Date.now()).toISOString() }]
  };
}

function initialTaskMessages(taskId, author, content, createdAt = Date.now()) {
  return String(content || "").trim() ? [messageRecord(taskId, author, content, createdAt)] : [];
}

function extractMentions(content) {
  const found = new Map();
  mentionableMembers.forEach((member) => {
    if (new RegExp(`(^|\\s)@${escapeRegExp(member.name)}(?=\\s|$|[.,!?;:])`, "iu").test(content)) found.set(member.id, { id: member.id, name: member.name });
  });
  return [...found.values()];
}

function taskDiscussionPreview(item) {
  const messages = item.messages || [];
  return messages.length ? messages[messages.length - 1].content : "";
}

function discussionMarkup(item) {
  const messages = item.messages || [];
  return `<section class="task-discussion" id="taskDiscussion">
    <header><div><p class="eyebrow">Discussion</p><h3>💬 Discussion</h3></div><span>${messages.length} message${messages.length > 1 ? "s" : ""}</span></header>
    <div class="discussion-messages" id="discussionMessages">
      ${messages.length ? messages.map(messageMarkup).join("") : `<div class="discussion-empty"><strong>Aucun message.</strong><span>Commencez une discussion ou mentionnez un collaborateur avec @.</span></div>`}
    </div>
    ${isDeleted(item) ? "" : `<div class="discussion-composer">
      <textarea id="discussionInput" rows="2" placeholder="Écrire un message… Utilisez @ pour mentionner"></textarea>
      <div class="mention-suggestions" id="mentionSuggestions" hidden></div>
      <button id="sendDiscussionMessage" type="button">Envoyer</button>
    </div>`}
  </section>`;
}

function messageMarkup(message) {
  const member = mentionableMembers.find((candidate) => candidate.name === message.author);
  const avatar = member && state.avatars[member.id];
  const readers = (message.readBy || []).filter((read) => read.user !== message.author);
  return `<article class="discussion-message" id="message-${escapeHtml(message.id)}">
    <div class="discussion-avatar">${avatar ? `<img src="${avatar}" alt="">` : escapeHtml(message.author[0] || "?")}</div>
    <div class="discussion-bubble">
      <header><strong>${escapeHtml(message.author)}</strong><time>${formatMessageTime(message.createdAt)}</time></header>
      <p>${renderMessageContent(message.content)}</p>
      <small>${readers.length ? `👀 Vu par ${readers.map((read) => `${escapeHtml(read.user)} à ${escapeHtml(read.time || "")}`).join(", ")}` : "Pas encore vu"}</small>
    </div>
  </article>`;
}

function renderMessageContent(content) {
  return escapeHtml(content).replace(/(^|\s)@([\p{L}-]+)/gu, '$1<span class="mention-token">@$2</span>').replace(/\n/g, "<br>");
}

function formatMessageTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function unreadMessageCount(item) {
  if (!CURRENT_USER) return 0;
  return (item.messages || []).filter((message) => message.author !== CURRENT_USER && !(message.readBy || []).some((read) => read.user === CURRENT_USER)).length;
}

function markDiscussionRead(item) {
  let changed = false;
  (item.messages || []).forEach((message) => {
    message.readBy ||= [];
    if (message.author !== CURRENT_USER && !message.readBy.some((read) => read.user === CURRENT_USER)) {
      message.readBy.push({ user: CURRENT_USER, userId: memberIdForName(CURRENT_USER), time: timeNow(), at: new Date().toISOString() });
      changed = true;
    }
  });
  if (changed) save(item);
}

function bindDiscussion(item) {
  const input = document.querySelector("#discussionInput");
  const suggestions = document.querySelector("#mentionSuggestions");
  if (!input || !suggestions) return;
  let activeMentionIndex = 0;
  const refreshSuggestions = () => {
    renderMentionSuggestions(input, suggestions);
    activeMentionIndex = 0;
    setActiveMentionSuggestion(suggestions, activeMentionIndex);
  };
  input.addEventListener("input", refreshSuggestions);
  input.addEventListener("keydown", (event) => {
    const options = [...suggestions.querySelectorAll("[data-mention-name]")];
    if (!suggestions.hidden && options.length && ["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) {
      event.preventDefault();
      if (event.key === "ArrowDown") activeMentionIndex = (activeMentionIndex + 1) % options.length;
      if (event.key === "ArrowUp") activeMentionIndex = (activeMentionIndex - 1 + options.length) % options.length;
      if (event.key === "Enter") {
        insertMention(input, options[activeMentionIndex].dataset.mentionName);
        suggestions.hidden = true;
        return;
      }
      setActiveMentionSuggestion(suggestions, activeMentionIndex);
      return;
    }
    if (event.key === "Escape" && !suggestions.hidden) {
      suggestions.hidden = true;
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") addDiscussionMessage(item);
  });
  suggestions.addEventListener("click", (event) => {
    const option = event.target.closest("[data-mention-name]");
    if (!option) return;
    insertMention(input, option.dataset.mentionName);
    suggestions.hidden = true;
  });
  document.querySelector("#sendDiscussionMessage")?.addEventListener("click", () => addDiscussionMessage(item));
}

function renderMentionSuggestions(input, container) {
  const beforeCursor = input.value.slice(0, input.selectionStart);
  const match = beforeCursor.match(/(?:^|\s)@([\p{L}-]*)$/u);
  if (!match) {
    container.hidden = true;
    return;
  }
  const query = normalizeSearch(match[1]);
  const matches = mentionableMembers.filter((member) => normalizeSearch(member.name).startsWith(query));
  container.innerHTML = matches.map((member, index) => `<button class="${index === 0 ? "is-active" : ""}" data-mention-id="${member.id}" data-mention-name="${escapeHtml(member.name)}" type="button">@${escapeHtml(member.name)}</button>`).join("");
  container.hidden = !matches.length;
}

function setActiveMentionSuggestion(container, index) {
  container.querySelectorAll("[data-mention-name]").forEach((button, buttonIndex) => button.classList.toggle("is-active", buttonIndex === index));
}

function insertMention(input, name) {
  const before = input.value.slice(0, input.selectionStart).replace(/@[\p{L}-]*$/u, `@${name} `);
  const after = input.value.slice(input.selectionEnd);
  input.value = before + after;
  input.focus();
  input.setSelectionRange(before.length, before.length);
}

function addDiscussionMessage(item) {
  const input = document.querySelector("#discussionInput");
  const content = input?.value.trim();
  if (!content) return;
  const message = messageRecord(item.id, CURRENT_USER, content);
  item.messages ||= [];
  item.messages.push(message);
  const mentionLabel = message.mentions.length ? ` · mentions : ${message.mentions.map((mention) => `@${mention.name}`).join(", ")}` : "";
  item.history.push(`Message de ${CURRENT_USER} : "${content}"${mentionLabel} — ${dateTimeNow()}`);
  save(item);
  render();
  notifyDiscussionMessage(item, message);
  openTask(item.id, message.id);
}

function notifyDiscussionMessage(item, message) {
  const notified = new Set();
  message.mentions.forEach((mention) => {
    if (mention.name === message.author || notified.has(mention.id)) return;
    notified.add(mention.id);
    sendPush(
      mention.name,
      `💬 ${message.author} vous a mentionné dans :`,
      `${item.title}\n« ${notificationMessagePreview(message.content)} »`,
      taskDeepLink(item.id, message.id),
      `task:${item.id}:mention:${message.id}:${mention.id}`
    );
  });
  const creatorId = memberIdForName(item.createdBy);
  if (item.createdBy !== message.author && !notified.has(creatorId)) {
    sendPush(
      item.createdBy,
      `💬 ${message.author} a répondu à la tâche :`,
      `${item.title}\n« ${notificationMessagePreview(message.content)} »`,
      taskDeepLink(item.id, message.id),
      `task:${item.id}:reply:${message.id}:${creatorId}`
    );
  }
}

function notificationMessagePreview(content) {
  const text = String(content || "").replace(/\s+/g, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

function focusDiscussionMessage(messageId) {
  if (!messageId) return;
  requestAnimationFrame(() => {
    const message = document.getElementById(`message-${messageId}`);
    if (!message) return;
    message.scrollIntoView({ behavior: "smooth", block: "center" });
    message.classList.add("is-highlighted");
    window.setTimeout(() => message.classList.remove("is-highlighted"), 4000);
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const pushed = await sendPush(item.assignee, "Tâche relancée", `${CURRENT_USER} vous a relancé pour la tâche : ${item.title}`, taskDeepLink(item.id), `task:${item.id}:remind:${bucket}`);
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
  closeTaskDialog();
  showToast("Fiche supprimée");
}

function openMember(id) {
  const member = members.find((item) => item.id === id);
  if (!member) return;
  const tasks = state.tasks.filter((item) => item.assignee === member.name && !isDeleted(item));
  el.memberDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">Profil</p><h2>${member.name}</h2><p>${member.role}</p></div></header><section class="task-list"><h3>En cours</h3>${tasks.filter((item) => !isCompleted(item)).map(toolTask).join("") || `<p>Aucune tâche.</p>`}</section><details class="profile-done"><summary>Terminées</summary>${tasks.filter(isCompleted).map(archiveTask).join("") || `<p>Aucune tâche terminée.</p>`}</details>`;
  el.memberDialog.showModal();
}

function openContactEditor(id = "") {
  if (!requireIdentity()) return;
  const contact = id ? state.addressBook.find((item) => item.id === id) : normalizeContact({});
  if (!contact) return;
  el.taskDetails.innerHTML = `<header class="member-header"><div><p class="eyebrow">Carnet d’adresses</p><h2>${id ? "Modifier contact" : "Nouveau contact"}</h2></div></header>
    <form class="task-form creator-form contact-form" id="contactForm">
      <input type="hidden" name="id" value="${escapeHtml(contact.id)}">
      ${contactFieldsMarkup(contact)}
      <button class="primary-action visible wide" type="submit">${id ? "Enregistrer" : "Créer le contact"}</button>
    </form>`;
  document.querySelector("#contactForm").addEventListener("submit", saveContactFromEditor);
  bindAddressAutocomplete(document.querySelector("#contactForm"));
  el.taskDialog.showModal();
}

function contactFieldsMarkup(contact = {}) {
  return `<label>Prénom<input name="firstName" value="${escapeHtml(contact.firstName || "")}" autocomplete="given-name"></label>
    <label>Nom<input name="lastName" value="${escapeHtml(contact.lastName || "")}" autocomplete="family-name"></label>
    <label>Société<input name="company" value="${escapeHtml(contact.company || "")}"></label>
    <label>Téléphone<input name="phone" value="${escapeHtml(contact.phone || "")}" inputmode="tel" autocomplete="tel"></label>
    <label class="wide address-smart">Adresse<input name="address" value="${escapeHtml(contact.address || "")}" data-address-input autocomplete="off" placeholder="42 rue des aca"><div class="address-suggestions"></div></label>
    <label>Complément<input name="address2" value="${escapeHtml(contact.address2 || "")}"></label>
    <label>Code postal<input name="postcode" value="${escapeHtml(contact.postcode || "")}" inputmode="numeric" autocomplete="postal-code"></label>
    <label>Ville<input name="city" value="${escapeHtml(contact.city || "")}" autocomplete="address-level2"></label>
    <input name="country" type="hidden" value="${escapeHtml(contact.country || "France")}">
    <input name="latitude" type="hidden" value="${escapeHtml(contact.latitude || "")}">
    <input name="longitude" type="hidden" value="${escapeHtml(contact.longitude || "")}">
    <input name="addressLabel" type="hidden" value="${escapeHtml(contact.addressLabel || "")}">
    <input name="addressSelected" type="hidden" value="${contact.addressSelected ? "1" : ""}">
    <label>Digicode<input name="accessCode" value="${escapeHtml(contact.accessCode || "")}"></label>
    <label>Étage<input name="floor" value="${escapeHtml(contact.floor || "")}"></label>
    <label>Ascenseur<select name="elevator"><option value="">À préciser</option><option ${contact.elevator === "Oui" ? "selected" : ""}>Oui</option><option ${contact.elevator === "Non" ? "selected" : ""}>Non</option></select></label>
    <label class="wide">Instructions livreur<textarea name="courierInstructions">${escapeHtml(contact.courierInstructions || "")}</textarea></label>
    <label class="wide">Notes internes<textarea name="internalNotes">${escapeHtml(contact.internalNotes || "")}</textarea></label>`;
}

function contactFromForm(form, existing = {}) {
  const elevator = form.get("elevator") || "";
  return normalizeContact({
    ...existing,
    id: form.get("id") || existing.id,
    firstName: form.get("firstName") || "",
    lastName: form.get("lastName") || "",
    company: form.get("company") || "",
    phone: form.get("phone") || "",
    address: form.get("address") || "",
    address2: form.get("address2") || "",
    postcode: form.get("postcode") || "",
    city: form.get("city") || "",
    country: form.get("country") || "France",
    latitude: form.get("latitude") || null,
    longitude: form.get("longitude") || null,
    addressLabel: form.get("addressLabel") || "",
    addressSelected: form.get("addressSelected") === "1",
    accessCode: form.get("accessCode") || "",
    floor: form.get("floor") || "",
    elevator,
    hasElevator: elevator === "Oui" ? true : elevator === "Non" ? false : null,
    courierInstructions: form.get("courierInstructions") || "",
    internalNotes: form.get("internalNotes") || "",
    updatedAt: new Date().toISOString()
  });
}

function saveContactFromEditor(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const existing = state.addressBook.find((item) => item.id === form.get("id")) || {};
  const contact = contactFromForm(form, existing);
  upsertContact(contact);
  addActivity(`${CURRENT_USER} a ${existing.id ? "modifié" : "créé"} le contact ${contactFullName(contact)}`);
  closeTaskDialog();
  showToast("Contact enregistré");
}

function upsertContact(contact) {
  const index = state.addressBook.findIndex((item) => item.id === contact.id);
  if (index >= 0) state.addressBook[index] = contact;
  else state.addressBook.unshift(contact);
  save();
  renderAddressBook();
  syncContact(contact);
}

function archiveContact(id) {
  const contact = state.addressBook.find((item) => item.id === id);
  if (!contact || !confirm(`Archiver ${contactFullName(contact)} ?`)) return;
  contact.archivedAt = new Date().toISOString();
  contact.updatedAt = contact.archivedAt;
  upsertContact(contact);
  addActivity(`${CURRENT_USER} a archivé le contact ${contactFullName(contact)}`);
  showToast("Contact archivé");
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
    const newDelivery = event.target.closest("[data-new-delivery]");
    if (newDelivery) { event.stopPropagation(); openDeliveryCreator(); return; }
    const editContact = event.target.closest("[data-edit-contact]");
    if (editContact) { event.stopPropagation(); openContactEditor(editContact.dataset.editContact); return; }
    const archiveContactButton = event.target.closest("[data-archive-contact]");
    if (archiveContactButton) { event.stopPropagation(); archiveContact(archiveContactButton.dataset.archiveContact); return; }
    const member = event.target.closest("[data-member]");
    if (member) { event.stopPropagation(); el.searchResults.hidden = true; openMember(member.dataset.member); return; }
    const view = event.target.closest("[data-open-view]");
    if (view) { event.stopPropagation(); el.searchResults.hidden = true; showView(view.dataset.openView); return; }
    const smartFilter = event.target.closest("[data-smart-filter]");
    if (smartFilter) {
      event.stopPropagation();
      activeSearchFilter = smartFilter.dataset.smartFilter;
      el.searchFilters.querySelectorAll("[data-search-filter]").forEach((button) => button.classList.toggle("is-active", button.dataset.searchFilter === activeSearchFilter));
      showView("accueil");
      render();
      return;
    }
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
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.close === "taskDialog") {
      closeTaskDialog();
      return;
    }
    document.querySelector(`#${button.dataset.close}`).close();
  }));
  document.querySelector("#sidebarToggle").addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));
  document.querySelector("#enablePushButton").addEventListener("click", enablePush);
  document.querySelector("#changeProfileButton").addEventListener("click", changeProfile);
  document.querySelector("#newContactButton")?.addEventListener("click", () => openContactEditor());
  el.addressSearch?.addEventListener("input", renderAddressBook);
  el.profileGate.addEventListener("cancel", (event) => event.preventDefault());
  el.taskDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeTaskDialog();
  });
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
  if (openedTaskId && el.taskDialog.open) {
    el.taskDialog.close();
    openedTaskId = "";
    pendingMessageId = "";
  }
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === name));
  const rubricKey = name.startsWith("rubrique-") ? name.replace("rubrique-", "") : "";
  document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("is-active", rubricKey ? panel.dataset.panel === "rubrique" : panel.dataset.panel === name));
  if (rubricKey) renderRubric(rubricKey);
  lastViewHash = `#view-${name}`;
  location.hash = `view-${name}`;
}

function handleHash() {
  const hash = location.hash.slice(1);
  if (hash.startsWith("task-")) {
    const [taskId, messageId = ""] = hash.slice(5).split("&message=");
    return openTask(decodeURIComponent(taskId), decodeURIComponent(messageId), { updateRoute: false });
  }
  if (hash.startsWith("view-")) return showView(hash.slice(5));
  showView("accueil");
}

function setTaskRoute(taskId, messageId = "") {
  const messagePart = messageId ? `&message=${encodeURIComponent(messageId)}` : "";
  const nextHash = `#task-${encodeURIComponent(taskId)}${messagePart}`;
  if (location.hash !== nextHash) history.pushState({ taskId, messageId }, "", nextHash);
}

function closeTaskDialog() {
  if (el.taskDialog.open) el.taskDialog.close();
  openedTaskId = "";
  pendingMessageId = "";
  history.replaceState({}, "", lastViewHash || "#view-accueil");
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
  if (IS_CAPACITOR) {
    const push = nativePlugin("PushNotifications");
    if (!push) {
      el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Le plugin natif Push Notifications n’est pas disponible dans ce build iOS.</span>`;
      el.iphoneHelp.classList.add("is-visible");
      el.pushState.textContent = "Plugin Push absent";
      hapticNotify("ERROR");
      return;
    }
    bindNativePushListeners();
    el.iphoneHelp.innerHTML = `<strong>Notifications iPhone</strong><span>Autorisez les notifications pour recevoir les tâches, mentions, messages, rappels et livraisons Stuart.</span>`;
    el.iphoneHelp.classList.add("is-visible");
    el.pushState.textContent = "Demande d’autorisation iPhone...";
    const permission = await push.requestPermissions();
    if (permission.receive !== "granted") {
      el.pushState.textContent = "Notifications iPhone refusées";
      hapticNotify("ERROR");
      return;
    }
    el.pushState.textContent = "Enregistrement iPhone...";
    await push.register();
    return;
  }
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
  const user = mentionableMembers.find((member) => member.name === userName);
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

function taskDeepLink(taskId, messageId = "") {
  const messagePart = messageId ? `&message=${encodeURIComponent(messageId)}` : "";
  return `${APP_BASE_URL}index.html?v=${APP_VERSION}#task-${encodeURIComponent(taskId)}${messagePart}`;
}

function callEdgeFunction(functionName, body) {
  const url = `${EDGE_FUNCTION_BASE}/${functionName}`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 18000);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`, "x-client-info": `winess-hub-${CLIENT_ENV}` },
    body: JSON.stringify(body),
    signal: controller.signal
  }).finally(() => {
    window.clearTimeout(timeout);
  }).catch((error) => {
    console.error("Winess Hub Edge Function inaccessible", connectionDiagnostics(functionName, error));
    throw new Error(error?.name === "AbortError" ? "Connexion trop lente. Réessayez dans quelques secondes." : "Supabase inaccessible depuis cette app. Vérifiez la connexion Internet et les origines Capacitor.");
  });
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function connectionDiagnostics(scope, error = null) {
  return {
    scope,
    message: error?.message || "",
    env: CLIENT_ENV,
    protocol: location.protocol,
    origin: location.origin,
    href: location.href,
    online: navigator.onLine,
    storage: storageAvailable(),
    supabaseUrl: SUPABASE_URL,
    edgeBase: EDGE_FUNCTION_BASE
  };
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
function registerServiceWorker() {
  if (IS_CAPACITOR) return;
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((error) => console.warn("Service worker non enregistré", error)));
}

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
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    const [{ data: remoteTasks, error: taskError }, { data: remoteActivity, error: activityError }, { data: remoteProfiles, error: profileError }, { data: remoteContacts, error: contactError }] = await Promise.all([
      supabaseClient.from("hub_tasks").select("id,data,updated_at").order("updated_at", { ascending: false }),
      supabaseClient.from("hub_activity").select("id,event_time,text,created_at").order("created_at", { ascending: false }).limit(1000),
      supabaseClient.from("hub_profiles").select("id,avatar_url,updated_at"),
      supabaseClient.from("address_book").select("*").order("updated_at", { ascending: false })
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
    if (!contactError && remoteContacts?.length) {
      state.addressBook = remoteContacts.map(contactFromRow);
    } else if (!contactError) {
      await Promise.all(activeContacts().map(syncContact));
    }
    fallbackProfiles.forEach((row) => { if (row.data?.avatar) state.avatars[row.data.profileId] = row.data.avatar; });
    (remoteProfiles || []).forEach((profile) => { if (profile.avatar_url) state.avatars[profile.id] = profile.avatar_url; });
    const knownProfileIds = new Set([...fallbackProfiles.map((row) => row.data?.profileId), ...(remoteProfiles || []).map((profile) => profile.id)]);
    const profilesToMigrate = Object.entries(state.avatars).filter(([id, avatar]) => !knownProfileIds.has(id) && String(avatar).startsWith("data:image/"));
    storageSet(STORAGE_KEY, JSON.stringify(state));
    render();
    if (CURRENT_USER && location.hash.startsWith("#task-")) handleHash();
    setSyncState("Synchronisé", true);

    realtimeChannel = supabaseClient.channel("winess-hub-live", { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "task_changed" }, applyBroadcastTask)
      .on("broadcast", { event: "activity_added" }, applyBroadcastActivity)
      .on("broadcast", { event: "profile_changed" }, applyBroadcastProfile)
      .on("broadcast", { event: "contact_changed" }, applyBroadcastContact)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_tasks" }, applyRemoteTask)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "hub_activity" }, applyRemoteActivity);
    if (!profileError) realtimeChannel.on("postgres_changes", { event: "*", schema: "public", table: "hub_profiles" }, applyRemoteProfile);
    if (!contactError) realtimeChannel.on("postgres_changes", { event: "*", schema: "public", table: "address_book" }, applyRemoteContact);
    realtimeChannel.subscribe(async (status) => {
      setSyncState(status === "SUBSCRIBED" ? "Temps réel" : "Connexion...", status === "SUBSCRIBED");
      if (status === "SUBSCRIBED" && profilesToMigrate.length) await Promise.all(profilesToMigrate.map(([id, avatar]) => syncProfileFallback(id, avatar)));
    });
  } catch (error) {
    console.warn("Supabase indisponible, stockage local conservé.", connectionDiagnostics("initialize-supabase", error));
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

function contactRow(contact) {
  const normalized = normalizeContact(contact);
  return {
    id: normalized.id,
    first_name: normalized.firstName,
    last_name: normalized.lastName,
    company: normalized.company,
    phone: normalized.phone,
    address: normalized.address,
    address_extra: normalized.address2,
    postal_code: normalized.postcode,
    city: normalized.city,
    country: normalized.country,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    address_label: normalized.addressLabel,
    address_selected: normalized.addressSelected,
    access_code: normalized.accessCode,
    floor: normalized.floor,
    has_elevator: normalized.hasElevator,
    delivery_instructions: normalized.courierInstructions,
    internal_notes: normalized.internalNotes,
    archived_at: normalized.archivedAt,
    updated_by: memberIdForName(CURRENT_USER || "system"),
    created_by: memberIdForName(CURRENT_USER || "system")
  };
}

function contactFromRow(row) {
  return normalizeContact(row);
}

async function syncContact(contact) {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.from("address_book").upsert(contactRow(contact));
  if (error) setSyncState("Hors ligne", false);
  else broadcastChange("contact_changed", { contact });
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

function applyBroadcastContact({ payload }) {
  if (!payload?.contact || payload.source === CLIENT_ID) return;
  applyRemoteContact({ eventType: "UPDATE", new: contactRow(payload.contact), old: {} });
}

function applyRemoteTask(payload) {
  const id = payload.old?.id || payload.new?.id;
  if (!id) return;
  if (payload.new?.data?.kind === "profile") {
    applyRemoteProfile({ new: { id: payload.new.data.profileId, avatar_url: payload.new.data.avatar } });
    return;
  }
  const index = state.tasks.findIndex((item) => item.id === id);
  let incomingTask = null;
  if (payload.eventType === "DELETE") {
    if (index >= 0) state.tasks.splice(index, 1);
  } else {
    const item = migrateTask({ ...payload.new.data, id }, payload.new.updated_at);
    incomingTask = item;
    if (index >= 0) state.tasks[index] = item;
    else state.tasks.unshift(item);
  }
  storageSet(STORAGE_KEY, JSON.stringify(state));
  render();
  if (index < 0 && incomingTask?.assignee === CURRENT_USER && incomingTask.createdBy !== CURRENT_USER) hapticNotify("WARNING");
  if (el.taskDialog.open && openedTaskId === id) {
    openTask(id, pendingMessageId, { updateRoute: false });
    showToast("Fiche mise à jour en temps réel");
  }
}

function applyRemoteActivity(payload) {
  const row = payload.new;
  if (!row?.id || state.activity.some((event) => event.id === row.id)) return;
  state.activity.unshift({ id: row.id, time: row.event_time, text: row.text, createdAt: new Date(row.created_at).getTime() });
  state.activity = state.activity.slice(0, 100);
  storageSet(STORAGE_KEY, JSON.stringify(state));
  renderActivity();
}

function applyRemoteProfile(payload) {
  const row = payload.new;
  if (!row?.id) return;
  if (row.avatar_url) state.avatars[row.id] = row.avatar_url;
  else delete state.avatars[row.id];
  storageSet(STORAGE_KEY, JSON.stringify(state));
  render();
}

function applyRemoteContact(payload) {
  const row = payload.new || payload.old;
  if (!row?.id) return;
  const index = state.addressBook.findIndex((contact) => contact.id === row.id);
  if (payload.eventType === "DELETE") {
    if (index >= 0) state.addressBook.splice(index, 1);
  } else {
    const contact = contactFromRow(row);
    if (index >= 0) state.addressBook[index] = contact;
    else state.addressBook.unshift(contact);
  }
  storageSet(STORAGE_KEY, JSON.stringify(state));
  renderAddressBook();
}

function setSyncState(label, online) {
  if (!el.syncState) return;
  el.syncState.textContent = label;
  el.syncState.classList.toggle("is-online", online);
}
