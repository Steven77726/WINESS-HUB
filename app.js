const STORAGE_KEY = "winess-hub:v5";
const CURRENT_USER_ID = "steven";
const BUSY_REMINDER_DELAY = 20 * 60 * 1000;

const members = [
  {
    id: "david",
    group: "direction",
    name: "David",
    role: "Direction",
    avatar: "",
    status: "available",
    tasks: ["🟠 Validation Azran", "🔴 Litige fournisseur"],
    priorities: ["🔥 Valider commande hôtel"]
  },
  {
    id: "zacharie",
    group: "direction",
    name: "Zacharie",
    role: "Direction",
    avatar: "",
    status: "available",
    tasks: ["📞 Rappeler Mme Cohen", "⚠️ Litige client"],
    priorities: ["🔥 Rappeler Cohen"]
  },
  {
    id: "valerie",
    group: "direction",
    name: "Valérie",
    role: "Direction",
    avatar: "",
    status: "available",
    tasks: ["⚠️ Anomalie facture"],
    priorities: []
  },
  {
    id: "steven",
    group: "staff",
    name: "Steven",
    role: "Staff",
    avatar: "assets/team/steven.svg",
    status: "available",
    tasks: ["📦 Préparer commande Azran", "🧀 Vérification stock Azul", "🚚 Livraison hôtel"],
    priorities: ["🔥 Préparer Azran", "🔥 Livraison hôtel 15h"]
  },
  {
    id: "theo",
    group: "staff",
    name: "Théo",
    role: "Staff",
    avatar: "",
    status: "available",
    tasks: ["📍 Mettre de côté", "📦 Vérifier reliquat"],
    priorities: ["🔥 Vérifier reliquat"]
  }
];

const tools = {
  commandes: [
    { title: "Commande Azran", meta: "2 coffrets + contrôle dispo Wino", tone: "gold" },
    { title: "Commande Azul", meta: "Stock réservé à confirmer", tone: "blue" },
    { title: "Commande magasin Benhamou", meta: "Terminée et archivée", tone: "green" }
  ],
  livraisons: [
    { title: "Livraison hôtel 15h", meta: "Priorité Staff · Steven", tone: "red" },
    { title: "Départ Neuilly", meta: "Sac isotherme + ticket", tone: "gold" }
  ],
  rappels: [
    { title: "Rappeler Mme Cohen", meta: "En retard · Zacharie", tone: "red" },
    { title: "Relance Instagram", meta: "Aujourd'hui 17h", tone: "gold" }
  ],
  stock: [
    { title: "Azran assortiment", meta: "Wino 24 · réservé 7 · disponible 17", tone: "green" },
    { title: "Pistaches grillées", meta: "Wino 18 · réservé 11 · disponible 7", tone: "gold" },
    { title: "Saumon fumé", meta: "Wino 9 · réservé 8 · disponible 1", tone: "red" }
  ],
  notifications: [
    { title: "Nouvelle tâche", meta: "Préparer commande Azran assignée à Steven", tone: "gold" },
    { title: "Vocal ajouté", meta: "Note vocale sur livraison hôtel", tone: "blue" },
    { title: "Tâche terminée", meta: "Commande Benhamou validée", tone: "green" }
  ],
  archives: [
    { title: "Commande Benhamou", meta: "Terminée · historique conservé", tone: "green" },
    { title: "Relance fournisseur", meta: "Archivée sans suppression", tone: "blue" }
  ]
};

const state = {
  selectedAvatarId: "",
  profiles: {}
};

const elements = {
  directionGrid: document.querySelector("#directionGrid"),
  staffGrid: document.querySelector("#staffGrid"),
  viewTitle: document.querySelector("#viewTitle"),
  avatarUpload: document.querySelector("#avatarUpload"),
  memberDialog: document.querySelector("#memberDialog"),
  memberDetails: document.querySelector("#memberDetails"),
  spotlightResults: document.querySelector("#spotlightResults"),
  globalSearch: document.querySelector("#globalSearch"),
  availabilityPrompt: document.querySelector("#availabilityPrompt"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  commandesList: document.querySelector("#commandesList"),
  livraisonsList: document.querySelector("#livraisonsList"),
  rappelsList: document.querySelector("#rappelsList"),
  stockGrid: document.querySelector("#stockGrid"),
  notificationsList: document.querySelector("#notificationsList"),
  archivesList: document.querySelector("#archivesList")
};

hydrate();
render();
bindGlobalActions();
checkBusyReminder();
handleHash();
setupSidebar();
registerServiceWorker();

function hydrate() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state.profiles = saved.profiles || {};
  } catch {
    state.profiles = {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profiles: state.profiles }));
  } catch {
    // Le prototype reste utilisable même si le stockage local est bloqué.
  }
}

function profileFor(member) {
  return {
    avatar: member.avatar,
    status: member.status,
    ...state.profiles[member.id]
  };
}

function render() {
  elements.directionGrid.innerHTML = members.filter((member) => member.group === "direction").map(memberCard).join("");
  elements.staffGrid.innerHTML = members.filter((member) => member.group === "staff").map(memberCard).join("");
  renderToolViews();
  bindCards();
}

function memberCard(member) {
  const profile = profileFor(member);
  const isBusy = profile.status === "busy";
  const avatar = profile.avatar || "";
  return `
    <article class="employee-card ${member.group}" data-member="${member.id}" tabindex="0" role="button" aria-label="Ouvrir ${member.name}">
      <input class="status-radio status-available-radio" id="status-${member.id}-available" name="status-${member.id}" type="radio" ${!isBusy ? "checked" : ""}>
      <input class="status-radio status-busy-radio" id="status-${member.id}-busy" name="status-${member.id}" type="radio" ${isBusy ? "checked" : ""}>
      <div class="employee-top">
        <span class="photo">
          ${avatar ? `<img src="${avatar}" alt="Avatar ${member.name}">` : `<span>${member.name.slice(0, 1)}</span>`}
          <span class="presence available">🟢 Disponible</span>
          <span class="presence busy">🌙 Occupé</span>
          <button class="avatar-edit" type="button" data-avatar="${member.id}" aria-label="Modifier avatar ${member.name}">+</button>
        </span>
      </div>
      <div class="availability-toggle">
        <label class="status-choice available-choice" for="status-${member.id}-available" aria-label="${member.name} disponible" title="Disponible">🟢</label>
        <label class="status-choice busy-choice" for="status-${member.id}-busy" aria-label="${member.name} occupé" title="Occupé">🌙</label>
      </div>
      <div class="employee-tags">
        ${member.tasks.slice(0, 3).map((task) => `<button type="button" class="task-chip" data-task="${member.id}:${task}">${task}</button>`).join("")}
      </div>
      <div class="employee-bottom">
        <div>
          <h3>${member.name}</h3>
          <p>${member.role}</p>
        </div>
        <div class="employee-counts">
          <span>${member.tasks.length} tâches</span>
          <span>${member.priorities.length} priorités</span>
        </div>
      </div>
    </article>
  `;
}

function renderToolViews() {
  elements.commandesList.innerHTML = tools.commandes.map(toolItem).join("");
  elements.livraisonsList.innerHTML = tools.livraisons.map(toolItem).join("");
  elements.rappelsList.innerHTML = tools.rappels.map(toolItem).join("");
  elements.stockGrid.innerHTML = tools.stock.map(toolItem).join("");
  elements.notificationsList.innerHTML = tools.notifications.map(toolItem).join("");
  elements.archivesList.innerHTML = tools.archives.map(toolItem).join("");
}

function toolItem(item) {
  return `
    <article class="tool-card ${item.tone}" data-tool-item="${item.title}">
      <strong>${item.title}</strong>
      <p>${item.meta}</p>
    </article>
  `;
}

function bindCards() {
  document.querySelectorAll("[data-member]").forEach((card) => {
    card.addEventListener("click", () => openMember(card.dataset.member));
  });
  document.querySelectorAll("[data-avatar]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      state.selectedAvatarId = button.dataset.avatar;
      elements.avatarUpload.click();
    });
  });
  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const [id, status] = button.dataset.status.split(":");
      setStatus(id, status, event);
    });
  });
  document.querySelectorAll(".status-radio").forEach((input) => {
    input.addEventListener("change", () => {
      const id = input.name.replace("status-", "");
      const status = input.classList.contains("status-busy-radio") ? "busy" : "available";
      state.profiles[id] = { ...state.profiles[id], status, busySince: status === "busy" ? Date.now() : 0 };
      persist();
      checkBusyReminder();
    });
  });
  document.querySelectorAll(".availability-toggle label").forEach((label) => {
    label.addEventListener("click", (event) => event.stopPropagation());
  });
  document.querySelectorAll("[data-task]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const [id, task] = button.dataset.task.split(":");
      openMember(id, task);
    });
  });
}

function bindGlobalActions() {
  document.addEventListener("click", handleDelegatedClick, true);
  window.addEventListener("hashchange", handleHash);
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
  elements.avatarUpload.addEventListener("change", updateAvatar);
  document.querySelector("#closeDialog").addEventListener("click", () => elements.memberDialog.close());
  elements.globalSearch.addEventListener("input", search);
}

function setupSidebar() {
  if (matchMedia("(max-width: 900px)").matches) document.body.classList.add("sidebar-collapsed");
  elements.sidebarToggle?.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-collapsed");
  });

  let startX = 0;
  let startY = 0;
  document.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  }, { passive: true });

  document.addEventListener("touchend", (event) => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - startX;
    const dy = Math.abs(touch.clientY - startY);
    if (dy > 60 || Math.abs(dx) < 58) return;
    if (startX < 34 && dx > 0) document.body.classList.remove("sidebar-collapsed");
    if (dx < 0 && startX < 280) document.body.classList.add("sidebar-collapsed");
  }, { passive: true });
}

function showView(view) {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === view);
  });
  elements.viewTitle.textContent = view === "accueil" ? "Bonjour Steven" : document.querySelector(`[data-view="${view}"]`).textContent;
  elements.spotlightResults.classList.remove("is-visible");
}

function handleDelegatedClick(event) {
  const statusButton = event.target.closest?.("[data-status]");
  if (statusButton) {
    const [id, status] = statusButton.dataset.status.split(":");
    setStatus(id, status, event);
    return;
  }

  const resultButton = event.target.closest?.("[data-result]");
  if (resultButton) {
    elements.globalSearch.value = "";
    elements.spotlightResults.classList.remove("is-visible");
  }
}

function setStatus(id, status, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  state.profiles[id] = { ...state.profiles[id], status, busySince: status === "busy" ? Date.now() : 0 };
  persist();
  render();
  checkBusyReminder();
}

function updateAvatar(event) {
  const file = event.target.files?.[0];
  if (!file || !state.selectedAvatarId) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    state.profiles[state.selectedAvatarId] = {
      ...state.profiles[state.selectedAvatarId],
      avatar: reader.result
    };
    persist();
    render();
    event.target.value = "";
  });
  reader.readAsDataURL(file);
}

function openMember(id, focusTask = "") {
  const member = members.find((item) => item.id === id);
  if (!member) return;
  const profile = profileFor(member);
  elements.memberDetails.innerHTML = `
    <header class="member-header">
      <span class="photo large">${profile.avatar ? `<img src="${profile.avatar}" alt="Avatar ${member.name}">` : `<span>${member.name.slice(0, 1)}</span>`}</span>
      <div>
        <p class="eyebrow">Espace du membre</p>
        <h2>${member.name}</h2>
        <p>${member.role} · ${profile.status === "busy" ? "🌙 Occupé" : "🟢 Disponible"}</p>
      </div>
    </header>
    <section class="priority-strip">
      <p class="eyebrow">🔥 Priorité actuelle</p>
      <div>${member.priorities.length ? member.priorities.map((task) => `<button>${task}</button>`).join("") : "<span>Aucune urgence réelle.</span>"}</div>
    </section>
    <section class="task-list">
      ${(focusTask ? [focusTask] : member.tasks).map((task) => `<article class="task-card"><strong>${task}</strong><p>Assigné à ${member.name}. Historique et rappels visibles.</p></article>`).join("")}
    </section>
  `;
  elements.memberDialog.showModal();
}

function checkBusyReminder() {
  const member = members.find((item) => item.id === CURRENT_USER_ID);
  const profile = profileFor(member);
  const shouldPrompt = profile.status === "busy" && Date.now() - (profile.busySince || 0) > BUSY_REMINDER_DELAY;
  if (!shouldPrompt) {
    elements.availabilityPrompt.classList.remove("is-visible");
    elements.availabilityPrompt.innerHTML = "";
    return;
  }

  elements.availabilityPrompt.innerHTML = `
    <div>
      <strong>Passer en disponible ?</strong>
      <span>Tu es en mode occupé depuis un moment.</span>
    </div>
    <button type="button" data-busy-reminder="yes">Oui</button>
    <button type="button" data-busy-reminder="later">Plus tard</button>
  `;
  elements.availabilityPrompt.classList.add("is-visible");
  elements.availabilityPrompt.querySelector('[data-busy-reminder="yes"]').addEventListener("click", () => {
    state.profiles[CURRENT_USER_ID] = { ...state.profiles[CURRENT_USER_ID], status: "available", busySince: 0 };
    persist();
    render();
    checkBusyReminder();
  });
  elements.availabilityPrompt.querySelector('[data-busy-reminder="later"]').addEventListener("click", () => {
    state.profiles[CURRENT_USER_ID] = { ...state.profiles[CURRENT_USER_ID], busySince: Date.now() };
    persist();
    checkBusyReminder();
  });
}

function search() {
  const query = elements.globalSearch.value.trim().toLowerCase();
  if (query.length < 2) {
    elements.spotlightResults.classList.remove("is-visible");
    elements.spotlightResults.innerHTML = "";
    return;
  }
  const memberResults = members
    .filter((member) => `${member.name} ${member.role} ${member.tasks.join(" ")} ${member.priorities.join(" ")}`.toLowerCase().includes(query))
    .map((member) => ({ type: "member", id: member.id, title: member.name, meta: `${member.role} · ${member.tasks.length} tâches` }));
  const toolResults = Object.entries(tools).flatMap(([view, items]) => (
    items
      .filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(query))
      .map((item) => ({ type: "view", view, title: item.title, meta: item.meta }))
  ));
  const results = [...memberResults, ...toolResults].slice(0, 8);
  state.searchResults = results;
  elements.spotlightResults.innerHTML = results.length ? results.map((result, index) => (
    `<a href="${result.type === "member" ? `#member-${result.id}` : `#view-${result.view}`}" data-result="${index}"><strong>${result.title}</strong><span>${result.meta}</span></a>`
  )).join("") : "<p>Aucun résultat</p>";
  elements.spotlightResults.classList.add("is-visible");
}

function handleHash() {
  const hash = location.hash.replace("#", "");
  if (hash.startsWith("member-")) {
    openMember(hash.replace("member-", ""));
    return;
  }
  if (hash.startsWith("view-")) {
    showView(hash.replace("view-", ""));
    return;
  }
  if (hash === "accueil") showView("accueil");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
