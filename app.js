const employees = [
  { id: "david", name: "David", role: "Directeur", status: "available", photo: "assets/team/david.png" },
  { id: "zacharie", name: "Zacharie", role: "Commercial", status: "late", photo: "assets/team/zacharie.png" },
  { id: "didier", name: "Didier", role: "Logistique", status: "busy", photo: "assets/team/didier.png" },
  { id: "steven", name: "Steven", role: "Préparateur", status: "busy", photo: "assets/team/steven.png" },
  { id: "theo", name: "Théo", role: "Préparateur", status: "available", photo: "assets/team/theo.png" },
  { id: "valerie", name: "Valérie", role: "Gestionnaire", status: "available", photo: "assets/team/valerie.png" }
];

const STORAGE_KEY = "winess-hub:v2";
const stateLabels = {
  "Vu": "👁 Vu",
  "Pris en charge": "🟠 Pris en charge",
  "Terminé": "✅ Terminé",
  "Bloqué": "⚠️ Bloqué"
};

const blockedReasons = ["Stock manquant", "Produit introuvable", "Attente livraison", "Client", "Autre"];

const teamSections = [
  {
    id: "direction",
    title: "Direction",
    subtitle: "Coordination, validations, rappels clients, anomalies et litiges.",
    members: ["david", "zacharie", "valerie"]
  },
  {
    id: "staff",
    title: "Staff",
    subtitle: "Exécution terrain, préparation, stock, mises de côté et livraisons.",
    members: ["theo", "steven"]
  }
];

const missionCatalog = {
  theo: ["📍 Mettre de côté", "📦 Préparer commande magasin", "🧀 Vérification stock", "💰 Demande devis", "📱 Rappel Instagram", "🚚 Préparer livraison", "📦 Vérifier reliquat", "➕ Autre"],
  steven: ["📍 Mettre de côté", "📦 Préparer commande magasin", "🧀 Vérification stock", "💰 Demande devis", "📱 Rappel Instagram", "🚚 Préparer livraison", "📦 Vérifier reliquat", "➕ Autre"],
  didier: ["📞 Rappeler client", "🛒 Commander fournisseur", "⚠️ Litige", "➕ Autre"],
  zacharie: ["📞 Rappeler client", "⚠️ Litige", "➕ Autre"],
  valerie: ["📞 Rappeler client", "⚠️ Anomalie", "➕ Autre"],
  david: ["📦 Préparer commande magasin", "🚚 Préparer livraison", "📞 Rappeler client", "➕ Autre"]
};

const now = Date.now();
const state = {
  selectedEmployeeId: "steven",
  selectedMission: "",
  selectedTaskId: "",
  pendingVoice: false,
  pendingPhotos: 0,
  tasks: [
    createTask("Préparer Azran", "Steven", ["theo", "steven"], "theo", "Préparer commande magasin", "Haute", "Pris en charge", now - 38 * 60 * 1000, "Commande magasin avec contrôle disponibilité Wino.", true),
    createTask("Commander pistaches", "David", ["didier"], "didier", "Commander fournisseur", "Haute", "Vu", now - 154 * 60 * 1000, "Stock boutique bas, fournisseur à confirmer.", false),
    createTask("Rappeler Mme Cohen", "Valérie", ["zacharie"], "zacharie", "Rappeler client", "Normale", "Vu", now - 188 * 60 * 1000, "Demande de créneau livraison avant 18h.", false),
    createTask("Vérifier reliquat saumon", "Théo", ["theo"], "theo", "Vérifier reliquat", "Haute", "Bloqué", now - 64 * 60 * 1000, "Attente retour dépôt.", true),
    createTask("Départ livraison Neuilly", "Steven", ["david", "steven"], "david", "Préparer livraison", "Haute", "Pris en charge", now - 25 * 60 * 1000, "Ajouter sac isotherme et ticket.", false),
    createTask("Commande validée Benhamou", "Didier", ["valerie"], "valerie", "Rappeler client", "Basse", "Terminé", now - 22 * 60 * 1000, "Client prévenu.", true)
  ],
  stock: [
    { name: "Pistaches grillées", wino: 18, reserved: 11 },
    { name: "Azran assortiment", wino: 24, reserved: 7 },
    { name: "Saumon fumé", wino: 9, reserved: 8 },
    { name: "Foie gras", wino: 14, reserved: 3 }
  ],
  notifications: [
    "Nouvelle mission attribuée à Théo.",
    "Rappel visible: Rappeler Mme Cohen.",
    "Vocal ajouté sur Préparer Azran.",
    "Commande Benhamou terminée."
  ],
  archive: [
    createTask("Commande validée Benhamou", "Didier", ["valerie"], "valerie", "Rappeler client", "Basse", "Terminé", now - 22 * 60 * 1000, "Archivage sans suppression définitive.", true)
  ]
};

const elements = {
  employeeGrid: document.querySelector("#employeeGrid"),
  activeCount: document.querySelector("#activeCount"),
  reminderCount: document.querySelector("#reminderCount"),
  voiceCount: document.querySelector("#voiceCount"),
  viewTitle: document.querySelector("#viewTitle"),
  drawer: document.querySelector("#missionDrawer"),
  drawerPerson: document.querySelector("#drawerPerson"),
  drawerTabs: document.querySelector("#drawerTabs"),
  drawerTasks: document.querySelector("#drawerTasks"),
  missionOptions: document.querySelector("#missionOptions"),
  missionNote: document.querySelector("#missionNote"),
  quickAdd: document.querySelector("#quickAdd"),
  taskDialog: document.querySelector("#taskDialog"),
  taskTitle: document.querySelector("#taskTitle"),
  taskMeta: document.querySelector("#taskMeta"),
  taskStates: document.querySelector("#taskStates"),
  taskDetails: document.querySelector("#taskDetails"),
  taskComments: document.querySelector("#taskComments"),
  taskHistory: document.querySelector("#taskHistory"),
  stockReadout: document.querySelector("#stockReadout"),
  commandesList: document.querySelector("#commandesList"),
  livraisonsList: document.querySelector("#livraisonsList"),
  rappelsList: document.querySelector("#rappelsList"),
  stockGrid: document.querySelector("#stockGrid"),
  notificationFeed: document.querySelector("#notificationFeed"),
  archivesList: document.querySelector("#archivesList"),
  syncStatus: document.querySelector("#syncStatus"),
  globalSearch: document.querySelector("#globalSearch"),
  spotlightResults: document.querySelector("#spotlightResults")
};

init();

function init() {
  hydrateState();
  bindNavigation();
  bindDialogs();
  bindActions();
  render();
  registerServiceWorker();
}

function createTask(title, author, assignees, owner, type, priority, status, updatedAt, note, hasVoice) {
  return {
    id: crypto.randomUUID(),
    title,
    author,
    assignees,
    owner,
    type,
    priority,
    status,
    updatedAt,
    date: new Date(updatedAt).toLocaleDateString("fr-FR"),
    time: new Date(updatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    note,
    hasVoice,
    voiceDuration: hasVoice ? "0:24" : "",
    photos: title.includes("Azran") ? 2 : 0,
    blockedReason: status === "Bloqué" ? "Attente livraison" : "",
    comments: ["Créée depuis Winess Hub.", note],
    history: [
      { user: author, change: "création", from: "vide", to: status, at: updatedAt },
      { user: "Système", change: "sauvegarde", from: "local", to: "synchro temps réel", at: updatedAt + 1200 }
    ]
  };
}

function hydrateState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return;
    state.tasks = saved.tasks || state.tasks;
    state.stock = saved.stock || state.stock;
    state.notifications = saved.notifications || state.notifications;
    state.archive = saved.archive || state.archive;
  } catch {
    markSynced("Sauvegarde locale indisponible, mode mémoire actif.");
  }
}

function persistState(message) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      tasks: state.tasks,
      stock: state.stock,
      notifications: state.notifications,
      archive: state.archive
    }));
    markSynced(message);
  } catch {
    markSynced("Action gardée en mémoire, sauvegarde locale bloquée.");
  }
}

function bindNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
}

function bindDialogs() {
  document.querySelector("#closeDrawer").addEventListener("click", () => elements.drawer.close());
  document.querySelector("#closeTask").addEventListener("click", () => elements.taskDialog.close());
  document.querySelector("#openQuickAdd").addEventListener("click", () => elements.quickAdd.scrollIntoView({ behavior: "smooth", block: "center" }));
  elements.drawer.addEventListener("click", (event) => {
    if (event.target === elements.drawer) elements.drawer.close();
  });
  elements.taskDialog.addEventListener("click", (event) => {
    if (event.target === elements.taskDialog) elements.taskDialog.close();
  });
}

function bindActions() {
  document.querySelector("#newTaskButton").addEventListener("click", () => openEmployee(state.selectedEmployeeId));
  document.querySelector("#voiceQuick").addEventListener("click", () => {
    state.pendingVoice = true;
    notify("Vocal prêt à joindre à une mission.");
    persistState("Vocal temporaire sauvegardé.");
  });
  document.querySelector("#attachVoice").addEventListener("click", () => {
    state.pendingVoice = true;
    notify("Vocal joint à la prochaine mission.");
    persistState("Vocal prêt, reprise upload active.");
  });
  document.querySelector("#attachPhoto").addEventListener("click", () => {
    state.pendingPhotos += 1;
    notify("Photo ajoutée à la file d'upload.");
    persistState("Photo en file d'upload.");
  });
  document.querySelector("#saveMission").addEventListener("click", saveMission);
  document.querySelector("#commentForm").addEventListener("submit", addComment);
  document.querySelector("#productSearch").addEventListener("input", renderStockReadout);
  elements.globalSearch.addEventListener("input", handleSpotlightSearch);
  elements.globalSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearSpotlight(true);
  });
}

function render() {
  renderEmployees();
  renderStats();
  renderLists();
  renderStockReadout();
  renderStockGrid();
  renderNotifications();
  clearSpotlight(false);
  markSynced("Toutes les actions sont historisées.");
}

function renderEmployees() {
  elements.employeeGrid.innerHTML = teamSections.map((section) => {
    const sectionEmployees = section.members.map((id) => employees.find((employee) => employee.id === id)).filter(Boolean);
    const sectionTasks = uniqueTasksForMembers(section.members).filter((task) => task.status !== "Terminé");
    const sectionReminders = sectionTasks.filter(isReminder);

    return `
      <section class="team-section ${section.id}" aria-labelledby="${section.id}-title">
        <header class="team-section-header">
          <div>
            <p class="eyebrow">${section.title}</p>
            <h2 id="${section.id}-title">${section.title === "Direction" ? "Coordination / validation" : "Exécution terrain"}</h2>
            <p>${section.subtitle}</p>
          </div>
          <div class="section-metrics" aria-label="Résumé ${section.title}">
            <span>${sectionTasks.length} tâches non abouties</span>
            <span class="${sectionReminders.length ? "danger" : ""}">${sectionReminders.length} rappels retard</span>
          </div>
        </header>
        <div class="employee-grid ${section.id}">
          ${sectionEmployees.map((employee) => employeeCard(employee, section.id)).join("")}
        </div>
      </section>
    `;
  }).join("");

  bindEmployeeCards();
}

function employeeCard(employee, sectionId) {
    const tasks = tasksFor(employee.id).filter((task) => task.status !== "Terminé");
    const reminders = tasks.filter(isReminder);
    const visibleTags = tasks.slice(0, 3);
    const hidden = Math.max(tasks.length - visibleTags.length, 0);
    const pendingLabel = sectionId === "direction" ? "validations attente" : "en cours";

    return `
      <article class="employee-card ${sectionId}" data-employee="${employee.id}" role="button" tabindex="0" aria-label="Ouvrir les missions de ${employee.name}">
        <div class="employee-top">
          <span class="photo" aria-label="Photo ${employee.name}">
            <img src="${employee.photo}" alt="">
          </span>
          <span class="employee-actions">
            <button class="card-add" type="button" data-add-employee="${employee.id}" aria-label="Attribuer une mission à ${employee.name}">+</button>
            <span class="presence ${employee.status}">${statusText(employee.status)}</span>
          </span>
        </div>
        <div class="employee-tags">
          ${visibleTags.map((task) => taskChip(task)).join("")}
          ${hidden ? `<span class="task-chip">+${hidden} autres</span>` : ""}
        </div>
        <div class="employee-bottom">
          <div>
            <h2 class="employee-name">${employee.name}</h2>
            <p class="employee-role">${employee.role}</p>
          </div>
          <div class="employee-counts">
            <span class="count-pill">${tasks.length} tâches non abouties</span>
            ${reminders.length ? `<span class="count-pill danger">${reminders.length} rappels retard</span>` : `<span class="count-pill soft">${tasks.length} ${pendingLabel}</span>`}
          </div>
        </div>
      </article>
    `;
}

function bindEmployeeCards() {
  elements.employeeGrid.querySelectorAll("[data-employee]").forEach((card) => {
    card.addEventListener("click", () => openEmployee(card.dataset.employee));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") openEmployee(card.dataset.employee);
    });
  });
  elements.employeeGrid.querySelectorAll("[data-add-employee]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openEmployee(button.dataset.addEmployee);
      elements.quickAdd.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
  elements.employeeGrid.querySelectorAll("[data-task]").forEach((chip) => {
    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      openTask(chip.dataset.task);
    });
  });
}

function taskChip(task) {
  const tone = task.status === "Terminé" ? "done" : isReminder(task) ? "danger" : task.priority === "Haute" ? "warning" : "";
  return `<span class="task-chip ${tone}" data-task="${task.id}">${statusDot(task)} ${task.title}</span>`;
}

function renderStats() {
  const dashboardMemberIds = teamSections.flatMap((section) => section.members);
  const activeTasks = uniqueTasksForMembers(dashboardMemberIds).filter((task) => task.status !== "Terminé");
  elements.activeCount.textContent = activeTasks.length;
  elements.reminderCount.textContent = activeTasks.filter(isReminder).length;
  elements.voiceCount.textContent = activeTasks.filter((task) => task.hasVoice).length;
}

function renderLists() {
  renderTaskList(elements.commandesList, state.tasks.filter((task) => task.type.includes("commande") || task.type.includes("Mettre")));
  renderTaskList(elements.livraisonsList, state.tasks.filter((task) => task.type.includes("livraison")));
  renderTaskList(elements.rappelsList, state.tasks.filter(isReminder));
  renderTaskList(elements.archivesList, state.archive);
}

function renderTaskList(container, tasks) {
  container.innerHTML = tasks.length ? tasks.map(taskCard).join("") : `<article class="task-card"><p>Aucune mission ici pour le moment.</p></article>`;
  container.querySelectorAll("[data-open-task]").forEach((card) => {
    card.addEventListener("click", () => openTask(card.dataset.openTask));
  });
}

function taskCard(task) {
  const reminder = reminderMeta(task);
  return `
    <article class="task-card" data-open-task="${task.id}">
      <div class="task-card-top">
        <div>
          <h3>${task.title}</h3>
          <p>${task.note}</p>
        </div>
        <span class="state-pill ${stateClass(task)}">${stateLabels[task.status]}</span>
      </div>
      <div class="task-meta-row">
        <span class="tiny-pill">${task.type}</span>
        <span class="tiny-pill">${ownerName(task.owner)}</span>
        <span class="tiny-pill">${smartDateLabel(task.updatedAt)}</span>
        ${isReminder(task) ? `<span class="tiny-pill danger">${reminder.overdue} de retard</span>` : `<span class="tiny-pill">${reminder.remaining} avant rappel</span>`}
        ${task.hasVoice ? `<span class="tiny-pill">Vocal ${task.voiceDuration}</span>` : ""}
        ${task.photos ? `<span class="tiny-pill">${task.photos} photos</span>` : ""}
      </div>
    </article>
  `;
}

function openEmployee(employeeId) {
  state.selectedEmployeeId = employeeId;
  const employee = employees.find((item) => item.id === employeeId);
  const employeeTasks = tasksFor(employeeId);

  elements.drawerPerson.innerHTML = `
    <span class="photo"><img src="${employee.photo}" alt=""></span>
    <div>
      <p class="eyebrow">Espace missions</p>
      <h2>${employee.name}</h2>
      <p class="drawer-role">${employee.role}</p>
    </div>
  `;
  elements.drawerTabs.innerHTML = ["Toutes", "Actives", "Rappels", "Terminées"].map((tab, index) => (
    `<button class="drawer-tab ${index === 0 ? "is-active" : ""}" type="button" data-tab="${tab}">${tab}</button>`
  )).join("");
  const priorityTasks = priorityTasksFor(employeeId);
  elements.drawerTasks.previousElementSibling?.classList.contains("priority-strip") && elements.drawerTasks.previousElementSibling.remove();
  elements.drawerTasks.insertAdjacentHTML("beforebegin", `
    <section class="priority-strip" aria-label="Priorité actuelle">
      <div>
        <p class="eyebrow">🔥 Priorité actuelle</p>
        <strong>${priorityTasks.length ? "À traiter maintenant" : "Rien de critique"}</strong>
      </div>
      <div class="priority-tags">
        ${priorityTasks.length ? priorityTasks.map((task) => `<button type="button" class="priority-tag" data-task="${task.id}">🔥 ${task.title}</button>`).join("") : `<span class="priority-empty">Aucune urgence réelle.</span>`}
      </div>
    </section>
  `);
  renderTaskList(elements.drawerTasks, employeeTasks);
  renderMissionOptions(employeeId);
  elements.drawer.querySelectorAll(".priority-tag").forEach((tag) => {
    tag.addEventListener("click", () => openTask(tag.dataset.task));
  });
  elements.drawer.showModal();
}

function renderMissionOptions(employeeId) {
  const options = missionCatalog[employeeId] || missionCatalog.david;
  state.selectedMission = options[0];
  elements.missionOptions.innerHTML = options.map((option, index) => (
    `<button class="mission-option ${index === 0 ? "is-selected" : ""}" type="button" data-mission="${option}">${option}</button>`
  )).join("");
  elements.missionOptions.querySelectorAll("[data-mission]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedMission = button.dataset.mission;
      elements.missionOptions.querySelectorAll(".mission-option").forEach((item) => item.classList.toggle("is-selected", item === button));
    });
  });
}

function saveMission() {
  const employee = employees.find((item) => item.id === state.selectedEmployeeId);
  const detail = elements.missionNote.value.trim();
  const title = detail || state.selectedMission;
  const task = createTask(title, "Steven", [employee.id], employee.id, state.selectedMission, "Normale", "Vu", Date.now(), detail || "Mission attribuée rapidement depuis le bouton plus.", state.pendingVoice);
  task.photos = state.pendingPhotos;
  state.tasks.unshift(task);
  state.notifications.unshift(`Nouvelle mission attribuée à ${employee.name}: ${title}.`);
  state.pendingVoice = false;
  state.pendingPhotos = 0;
  elements.missionNote.value = "";
  openEmployee(employee.id);
  render();
  notify("Mission attribuée.");
  persistState("Mission sauvegardée instantanément.");
}

function openTask(taskId) {
  const task = [...state.tasks, ...state.archive].find((item) => item.id === taskId);
  if (!task) return;
  state.selectedTaskId = taskId;
  elements.taskMeta.textContent = `${task.type} · ${task.date} ${task.time}`;
  elements.taskTitle.textContent = task.title;
  elements.taskStates.innerHTML = ["Vu", "Pris en charge", "Terminé", "Bloqué"].map((status) => (
    `<button class="state-pill ${status === task.status ? stateClass(task) : ""}" type="button" data-status="${status}">${stateLabels[status]}</button>`
  )).join("");
  const reminder = reminderMeta(task);
  elements.taskDetails.innerHTML = `
    <article><p class="eyebrow">Auteur</p><strong>${task.author}</strong></article>
    <article><p class="eyebrow">Responsable</p><strong>${ownerName(task.owner)}</strong></article>
    <article><p class="eyebrow">Assignés</p><strong>${task.assignees.map(ownerName).join(", ")}</strong></article>
    <article><p class="eyebrow">Priorité</p><strong>${task.priority}</strong></article>
    <article><p class="eyebrow">Rappel</p><strong>${isReminder(task) ? `${reminder.overdue} de retard` : `${reminder.remaining} restant`}</strong></article>
    <article><p class="eyebrow">Photos</p><strong>${task.photos}</strong></article>
    ${task.status === "Bloqué" ? `<article class="blocked-reasons"><p class="eyebrow">Cause blocage</p>${blockedReasons.map((reason) => `<button type="button" class="${task.blockedReason === reason ? "is-selected" : ""}" data-blocked-reason="${reason}">${reason}</button>`).join("")}</article>` : ""}
    <article class="voice-card"><p class="eyebrow">Vocal</p>${task.hasVoice ? `<button class="voice-play" type="button">Lire ${task.voiceDuration}</button>` : "<strong>Aucun</strong>"}</article>
  `;
  elements.taskComments.innerHTML = task.comments.map((comment) => `<div class="comment-entry">${comment}</div>`).join("");
  elements.taskHistory.innerHTML = task.history.map((entry) => (
    `<div class="history-entry">${new Date(entry.at).toLocaleString("fr-FR")} · ${entry.user} · ${entry.change}: ${entry.from} vers ${entry.to}</div>`
  )).join("");

  elements.taskStates.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => updateTaskStatus(task, button.dataset.status));
  });
  elements.taskDetails.querySelectorAll("[data-blocked-reason]").forEach((button) => {
    button.addEventListener("click", () => updateBlockedReason(task, button.dataset.blockedReason));
  });
  elements.taskDialog.showModal();
}

function updateTaskStatus(task, status) {
  const previous = task.status;
  task.status = status;
  if (status !== "Bloqué") task.blockedReason = "";
  if (status === "Bloqué" && !task.blockedReason) task.blockedReason = "Autre";
  task.updatedAt = Date.now();
  task.history.unshift({ user: "Steven", change: "statut", from: previous, to: status, at: Date.now() });
  state.notifications.unshift(`${task.title}: ${status}.`);
  if (status === "Terminé" && !state.archive.some((item) => item.id === task.id)) state.archive.unshift({ ...task });
  render();
  openTask(task.id);
  persistState("Changement de statut sauvegardé.");
}

function updateBlockedReason(task, reason) {
  const previous = task.blockedReason || "vide";
  task.blockedReason = reason;
  task.updatedAt = Date.now();
  task.history.unshift({ user: "Steven", change: "cause blocage", from: previous, to: reason, at: Date.now() });
  render();
  openTask(task.id);
  persistState("Cause de blocage sauvegardée.");
}

function addComment(event) {
  event.preventDefault();
  const input = document.querySelector("#commentInput");
  const value = input.value.trim();
  const task = state.tasks.find((item) => item.id === state.selectedTaskId);
  if (!value || !task) return;
  task.comments.push(value);
  task.history.unshift({ user: "Steven", change: "commentaire", from: "vide", to: value, at: Date.now() });
  input.value = "";
  openTask(task.id);
  persistState("Commentaire sauvegardé.");
}

function renderStockReadout() {
  const query = document.querySelector("#productSearch")?.value.toLowerCase() || "";
  const item = state.stock.find((stock) => stock.name.toLowerCase().includes(query)) || state.stock[0];
  const available = item.wino - item.reserved;
  elements.stockReadout.innerHTML = `
    <article><p class="eyebrow">Stock Wino</p><strong>${item.wino}</strong></article>
    <article><p class="eyebrow">Réservé</p><strong>${item.reserved}</strong></article>
    <article><p class="eyebrow">Disponible réel</p><strong>${available}</strong><span class="api-pill">API Wino live</span></article>
  `;
}

function renderStockGrid() {
  elements.stockGrid.innerHTML = state.stock.map((item) => {
    const available = item.wino - item.reserved;
    return `
      <article class="stock-card">
        <strong>${item.name}</strong>
        <div class="stock-bars">
          <span>Stock Wino <b>${item.wino}</b></span>
          <span>Réservé <b>${item.reserved}</b></span>
          <span>Disponible réel <b>${available}</b></span>
        </div>
      </article>
    `;
  }).join("");
}

function renderNotifications() {
  elements.notificationFeed.innerHTML = state.notifications.map((item) => `<article class="notification-item">${item}</article>`).join("");
}

function showView(view) {
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.view === view));
  document.querySelectorAll("[data-view-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.viewPanel === view));
  elements.viewTitle.textContent = view === "accueil" ? "Bonjour Steven" : document.querySelector(`[data-view="${view}"]`).textContent;
}

function tasksFor(employeeId) {
  return state.tasks.filter((task) => task.assignees.includes(employeeId));
}

function uniqueTasksForMembers(memberIds) {
  const memberSet = new Set(memberIds);
  const seen = new Set();
  return state.tasks.filter((task) => {
    if (!task.assignees.some((assignee) => memberSet.has(assignee)) || seen.has(task.id)) return false;
    seen.add(task.id);
    return true;
  });
}

function priorityTasksFor(employeeId) {
  return tasksFor(employeeId)
    .filter((task) => task.status !== "Terminé")
    .filter((task) => task.priority === "Haute" || task.status === "Bloqué" || isReminder(task))
    .sort((first, second) => {
      const firstScore = (isReminder(first) ? 4 : 0) + (first.status === "Bloqué" ? 3 : 0) + (first.priority === "Haute" ? 2 : 0);
      const secondScore = (isReminder(second) ? 4 : 0) + (second.status === "Bloqué" ? 3 : 0) + (second.priority === "Haute" ? 2 : 0);
      return secondScore - firstScore || second.updatedAt - first.updatedAt;
    })
    .slice(0, 3);
}

function handleSpotlightSearch() {
  const query = elements.globalSearch.value.trim().toLowerCase();
  if (query.length < 2) {
    clearSpotlight(false);
    return;
  }

  const taskResults = state.tasks
    .filter((task) => searchableTaskText(task).includes(query))
    .slice(0, 5)
    .map((task) => spotlightItem({
      label: task.title,
      meta: `${task.type} · ${ownerName(task.owner)} · ${smartDateLabel(task.updatedAt)}`,
      badge: isReminder(task) ? "Rappel" : task.status,
      action: () => openTask(task.id)
    }));

  const stockResults = state.stock
    .filter((item) => item.name.toLowerCase().includes(query))
    .slice(0, 3)
    .map((item) => {
      const available = item.wino - item.reserved;
      return spotlightItem({
        label: item.name,
        meta: `Stock Wino ${item.wino} · réservé ${item.reserved} · disponible réel ${available}`,
        badge: "Stock",
        action: () => showView("stock")
      });
    });

  const employeeResults = employees
    .filter((employee) => `${employee.name} ${employee.role}`.toLowerCase().includes(query))
    .slice(0, 3)
    .map((employee) => spotlightItem({
      label: employee.name,
      meta: `${employee.role} · ${tasksFor(employee.id).filter((task) => task.status !== "Terminé").length} tâches non abouties`,
      badge: "Membre",
      action: () => openEmployee(employee.id)
    }));

  const results = [...taskResults, ...stockResults, ...employeeResults];
  elements.spotlightResults.innerHTML = `
    <div class="spotlight-shell">
      <div class="spotlight-header">
        <span>Recherche IA</span>
        <strong>${results.length ? `${results.length} résultat${results.length > 1 ? "s" : ""}` : "Aucun résultat"}</strong>
      </div>
      ${results.length ? results.map((result, index) => result.html.replace("{{index}}", index)).join("") : `<p class="spotlight-empty">Aucune mission, commande, vocal, commentaire, tag, stock ou membre trouvé.</p>`}
    </div>
  `;
  elements.spotlightResults.classList.add("is-visible");
  results.forEach((result, index) => {
    elements.spotlightResults.querySelector(`[data-spotlight="${index}"]`)?.addEventListener("click", () => {
      clearSpotlight(true);
      result.action();
    });
  });
}

function clearSpotlight(clearInput = true) {
  elements.spotlightResults.classList.remove("is-visible");
  elements.spotlightResults.innerHTML = "";
  if (clearInput) elements.globalSearch.value = "";
}

function spotlightItem({ label, meta, badge, action }) {
  return {
    action,
    html: `
      <button class="spotlight-item" type="button" data-spotlight="{{index}}">
        <span>
          <strong>${escapeHTML(label)}</strong>
          <small>${escapeHTML(meta)}</small>
        </span>
        <em>${escapeHTML(badge)}</em>
      </button>
    `
  };
}

function searchableTaskText(task) {
  return [
    task.title,
    task.author,
    task.type,
    task.priority,
    task.status,
    task.note,
    task.blockedReason,
    ...task.comments,
    ...task.assignees.map(ownerName),
    task.hasVoice ? "vocal audio note" : "",
    task.photos ? "photo photos" : ""
  ].join(" ").toLowerCase();
}

function isReminder(task) {
  return task.status !== "Terminé" && Date.now() - task.updatedAt > 2 * 60 * 60 * 1000;
}

function reminderMeta(task) {
  const elapsed = Date.now() - task.updatedAt;
  const threshold = 2 * 60 * 60 * 1000;
  if (elapsed >= threshold) return { overdue: ageLabel(task.updatedAt + threshold), remaining: "0 min" };
  return { overdue: "0 min", remaining: durationLabel(threshold - elapsed) };
}

function ageLabel(updatedAt) {
  const minutes = Math.floor((Date.now() - updatedAt) / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function durationLabel(duration) {
  const minutes = Math.ceil(duration / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
}

function smartDateLabel(updatedAt) {
  const minutes = Math.round((updatedAt - Date.now()) / 60000);
  const absolute = new Date(updatedAt);
  if (minutes < -120) return `en retard ${ageLabel(updatedAt)}`;
  if (minutes < -1) return `il y a ${Math.abs(minutes)} min`;
  if (minutes <= 1) return "maintenant";
  if (minutes < 60) return `dans ${minutes} min`;
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const time = absolute.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (absolute.toDateString() === today.toDateString()) return `aujourd'hui ${time}`;
  if (absolute.toDateString() === tomorrow.toDateString()) return `demain ${time}`;
  return absolute.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function statusDot(task) {
  if (task.status === "Terminé") return "🟢";
  if (isReminder(task)) return "🔴";
  if (task.status === "Pris en charge") return "🟠";
  if (task.status === "Bloqué") return "⚠️";
  return "👁";
}

function ownerName(id) {
  return employees.find((employee) => employee.id === id)?.name || id;
}

function stateClass(task) {
  if (task.status === "Terminé") return "done";
  if (task.status === "Bloqué") return "blocked";
  if (task.status === "Pris en charge") return "active";
  return "";
}

function statusText(status) {
  return {
    available: "Disponible",
    busy: "En cours",
    late: "Urgent"
  }[status] || "Live";
}

function notify(message) {
  state.notifications.unshift(message);
  renderNotifications();
  persistState("Notification sauvegardée.");
}

function markSynced(message) {
  elements.syncStatus.textContent = message;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
