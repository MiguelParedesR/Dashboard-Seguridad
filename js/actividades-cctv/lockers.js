
(() => {
  const AREA_BASE = ["LCL", "REEFERS", "LLENOS", "MAQUINARIAS", "TRANSPORTES", "VACIOS"];
  const LOCAL_BASE = ["TPP1", "TPP2", "TPP3", "TPP4"];
  const STATE_META = {
    LIBRE: {
      label: "Libre",
      color: "#1f9f6a",
      text: "#ffffff",
      icon: "fa-lock-open",
      hint: "Disponible"
    },
    OCUPADO: {
      label: "Asignado",
      color: "#e3b63d",
      text: "#3a2a00",
      icon: "fa-lock",
      hint: "Asignado"
    },
    SE_DESCONOCE: {
      label: "Se desconoce",
      color: "#7c58e3",
      text: "#ffffff",
      icon: "fa-circle-question",
      hint: "Sin dato"
    },
    MANTENIMIENTO: {
      label: "Mantenimiento",
      color: "#2f80d3",
      text: "#ffffff",
      icon: "fa-screwdriver-wrench",
      hint: "Revision"
    },
    BLOQUEADO: {
      label: "Bloqueado",
      color: "#e03a3a",
      text: "#ffffff",
      icon: "fa-ban",
      hint: "No disponible"
    }
  };
  const STATE_ORDER = ["LIBRE", "OCUPADO", "SE_DESCONOCE", "MANTENIMIENTO"];

  const VIRTUAL_LIMIT = 40;
  const VIRTUAL_STEP = 20;
  const LONG_PRESS_MS = 520;
  const COLLAPSE_KEY = "lockers:collapsed";
  const VIEW_MODE_KEY = "lockers:view-mode";
  const HEADER_COMPACT_Y = 140;
  const HEADER_EXPAND_Y = 80;

  const state = {
    lockers: [],
    selectedId: null,
    filters: {
      search: "",
      estado: "ALL",
      local: ""
    },
    initialLocal: "",
    localManual: false,
    viewMode: "assignments",
    channel: null,
    active: false,
    loading: false,
    loadingColumns: new Set(),
    updatedIds: new Set(),
    updateTimers: new Map(),
    virtualization: {
      enabled: false,
      limits: {}
    },
    collapsedStates: {},
    quickMenu: {
      open: false,
      lockerId: null
    },
    isCompact: false,
    panelLocked: false,
    suppressClick: false,
    touchStart: null
  };

  let dom = {};
  let searchTimer = null;
  let longPressTimer = null;
  let scrollTicking = false;

  const MODULE_KEY = "lockers";

  function resolveDbKey() {
    return window.CONFIG?.SUPABASE?.resolveDbKeyForModule?.(MODULE_KEY) || "LOCKERS";
  }

  function getSupabaseClient() {
    const dbKey = resolveDbKey();
    return window.CONFIG?.SUPABASE?.getClient?.(dbKey) || null;
  }

  function waitForSupabase(maxAttempts = 40, waitMs = 250) {
    const dbKey = resolveDbKey();
    const waiter = window.CONFIG?.SUPABASE?.waitForClient;
    if (typeof waiter !== "function") return Promise.resolve(null);
    return waiter(dbKey, { maxAttempts, waitMs });
  }

  function normalizeEstado(value) {
    if (!value) return "LIBRE";
    const normalized = String(value).trim().toUpperCase().replace(/\s+/g, "_");
    if (normalized === "ASIGNADO") return "OCUPADO";
    if (normalized === "DESCONOCIDO" || normalized === "SE_DESCONOCE" || normalized === "SE_DESCONOCIDO") {
      return "SE_DESCONOCE";
    }
    return normalized;
  }

  function normalizeArea(value) {
    if (!value) return "";
    return String(value).trim().toUpperCase();
  }

  function normalizeLocal(value) {
    if (!value) return "";
    return String(value).trim().toUpperCase();
  }

  function getStateMeta(value) {
    const key = normalizeEstado(value);
    return STATE_META[key] || STATE_META.LIBRE;
  }

  function formatDate(value) {
    if (!value) return "--";
    if (typeof value === "string") {
      if (value.includes("T")) return value.slice(0, 10);
      return value;
    }
    try {
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return "--";
      return dt.toISOString().slice(0, 10);
    } catch (err) {
      return "--";
    }
  }

  function readCollapseState() {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function saveCollapseState() {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state.collapsedStates));
    } catch (err) {
      // ignore storage issues
    }
  }

  function readViewMode() {
    try {
      const saved = localStorage.getItem(VIEW_MODE_KEY);
      return saved || "";
    } catch (err) {
      return "";
    }
  }

  function saveViewMode(mode) {
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch (err) {
      // ignore storage issues
    }
  }

  function formatRelativeTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return "hace instantes";
    if (diffMinutes < 60) return diffMinutes === 1 ? "hace 1 min" : `hace ${diffMinutes} min`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return diffHours === 1 ? "hace 1 h" : `hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return diffDays === 1 ? "hace 1 dia" : `hace ${diffDays} dias`;
  }

  function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(255, 255, 255, ${alpha})`;
    const raw = hex.replace("#", "");
    if (raw.length !== 6) return `rgba(255, 255, 255, ${alpha})`;
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function setCompactHeader(isCompact) {
    if (state.isCompact === isCompact) return;
    state.isCompact = isCompact;
    dom.root?.classList.toggle("is-compact", isCompact);
  }

  function handleHeaderScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(() => {
      if (!state.active || !dom.root) {
        scrollTicking = false;
        return;
      }
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if (!state.isCompact && y > HEADER_COMPACT_Y) {
        setCompactHeader(true);
      } else if (state.isCompact && y < HEADER_EXPAND_Y) {
        setCompactHeader(false);
      }
      scrollTicking = false;
    });
  }
  function setStatus(message, type = "info") {
    if (dom.status) {
      dom.status.textContent = message;
      dom.status.classList.remove("success", "error", "warn");
      if (type === "success") dom.status.classList.add("success");
      if (type === "error") dom.status.classList.add("error");
      if (type === "warn") dom.status.classList.add("warn");
    }
    if (type !== "info") showToast(message, type);
  }

  function showToast(message, type) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.classList.remove("success", "error", "warn");
    if (type) dom.toast.classList.add(type);
    dom.toast.classList.add("is-visible");
    clearTimeout(dom.toastTimer);
    dom.toastTimer = setTimeout(() => {
      dom.toast.classList.remove("is-visible");
    }, 2400);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function highlightText(text, query) {
    const value = String(text || "");
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) return escapeHtml(value);
    const lower = value.toLowerCase();
    const index = lower.indexOf(normalized);
    if (index === -1) return escapeHtml(value);
    const before = escapeHtml(value.slice(0, index));
    const match = escapeHtml(value.slice(index, index + normalized.length));
    const after = escapeHtml(value.slice(index + normalized.length));
    return `${before}<mark>${match}</mark>${after}`;
  }

  function getSelectedLocker() {
    const locker = state.lockers.find((item) => item.id === state.selectedId) || null;
    if (!locker) return null;
    const local = normalizeLocal(state.filters.local);
    if (local && local !== "ALL" && normalizeLocal(locker.local) !== local) return null;
    return locker;
  }

  function applyFilters(list, override = {}) {
    const searchValue = override.search !== undefined ? override.search : state.filters.search;
    const search = String(searchValue || "").trim().toLowerCase();
    const estado = override.estado !== undefined ? override.estado : state.filters.estado;
    const localValue = override.local !== undefined ? override.local : state.filters.local;
    const local = normalizeLocal(localValue);

    return list.filter((locker) => {
      if (locker.activo === false) return false;
      if (local && local !== "ALL" && normalizeLocal(locker.local) !== local) return false;
      if (estado !== "ALL" && normalizeEstado(locker.estado) !== estado) return false;

      if (!search) return true;
      const haystack = [locker.codigo, locker.colaborador_nombre]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(" ");
      return haystack.includes(search);
    });
  }

  function sortLockers(list) {
    return list.slice().sort((a, b) =>
      String(a.codigo || "").localeCompare(String(b.codigo || ""), "es", {
        numeric: true,
        sensitivity: "base"
      })
    );
  }

  function getAreaOptions(lockers) {
    const dynamic = new Set();
    lockers.forEach((locker) => {
      const area = normalizeArea(locker.area);
      if (area) dynamic.add(area);
    });
    const extras = Array.from(dynamic).filter((area) => !AREA_BASE.includes(area)).sort();
    return [...AREA_BASE, ...extras];
  }

  function getOrderedLocals(list) {
    const seen = new Set();
    const order = [];
    list.forEach((value) => {
      const normalized = normalizeLocal(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
    });
    LOCAL_BASE.forEach((local) => {
      if (seen.has(local)) {
        order.push(local);
        seen.delete(local);
      }
    });
    const extras = Array.from(seen).sort();
    return [...order, ...extras];
  }

  function getLocalOptions(lockers) {
    const dataLocals = [];
    lockers.forEach((locker) => {
      const local = normalizeLocal(locker.local);
      if (local) dataLocals.push(local);
    });
    return getOrderedLocals([...LOCAL_BASE, ...dataLocals]);
  }

  function getDataLocals(lockers) {
    const dataLocals = [];
    lockers.forEach((locker) => {
      const local = normalizeLocal(locker.local);
      if (local) dataLocals.push(local);
    });
    return getOrderedLocals(dataLocals);
  }

  function ensureAreaSelectOptions(lockers) {
    if (!dom.areaSelect) return;

    const options = getAreaOptions(lockers);
    const currentSelect = dom.areaSelect.value;

    dom.areaSelect.innerHTML = "";
    options.forEach((area) => {
      const option = document.createElement("option");
      option.value = area;
      option.textContent = area;
      dom.areaSelect.appendChild(option);
    });

    if (currentSelect) {
      dom.areaSelect.value = currentSelect;
    }
  }

  function ensureLocalSelectOptions(lockers) {
    if (!dom.localSelect) return;

    const options = getLocalOptions(lockers);
    const currentSelect = dom.localSelect.value;

    dom.localSelect.innerHTML = "";
    options.forEach((local) => {
      const option = document.createElement("option");
      option.value = local;
      option.textContent = local;
      dom.localSelect.appendChild(option);
    });

    if (currentSelect) {
      dom.localSelect.value = currentSelect;
    } else if (state.filters.local) {
      dom.localSelect.value = state.filters.local;
    }
  }

  function getLocalFromUrl() {
    try {
      const url = new URL(window.location.href);
      const fromQuery = url.searchParams.get("local");
      if (fromQuery) return fromQuery;
      if (url.hash) return url.hash.replace("#", "");
    } catch (err) {
      return "";
    }
    return "";
  }

  function ensureLocalSelection() {
    const dataLocals = getDataLocals(state.lockers);
    const allLocals = getLocalOptions(state.lockers);
    const current = normalizeLocal(state.filters.local);
    const initial = normalizeLocal(state.initialLocal);

    if (initial && allLocals.includes(initial)) {
      state.filters.local = initial;
      state.initialLocal = "";
      return;
    }

    if (!current) {
      state.filters.local = dataLocals[0] || allLocals[0] || "";
      return;
    }

    if (!state.localManual && dataLocals.length && !dataLocals.includes(current)) {
      state.filters.local = dataLocals[0];
    }
  }

  function updateUrlLocal(local) {
    try {
      const url = new URL(window.location.href);
      if (local) url.searchParams.set("local", local);
      else url.searchParams.delete("local");
      const nextUrl = `${url.pathname}${url.search}${url.hash}`;
      const nextState = Object.assign({}, history.state || {});
      history.replaceState(nextState, "", nextUrl);
    } catch (err) {
      // ignore
    }
  }

  function setLocalFilter(local, options = {}) {
    const normalized = normalizeLocal(local);
    if (!normalized) return;
    if (state.filters.local === normalized) return;
    state.filters.local = normalized;
    state.localManual = true;
    const selected = getSelectedLocker();
    if (selected && normalizeLocal(selected.local) !== normalized) {
      state.selectedId = null;
      state.panelLocked = false;
    }
    if (options.updateUrl !== false) updateUrlLocal(normalized);
    renderAll();
  }

  function updateViewModeUI() {
    if (!dom.root) return;
    const isAssignments = state.viewMode === "assignments";
    dom.root.classList.toggle("view-assignments", isAssignments);
    dom.root.classList.toggle("view-states", !isAssignments);
    if (dom.viewToggles) {
      dom.viewToggles.forEach((toggle) => {
        const isActive = toggle.dataset.view === state.viewMode;
        toggle.classList.toggle("is-active", isActive);
        toggle.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    }
  }

  function setViewMode(mode, options = {}) {
    if (!mode || (mode !== "assignments" && mode !== "states")) return;
    state.viewMode = mode;
    if (options.persist !== false) saveViewMode(mode);
    updateViewModeUI();
  }

  function renderLocalTabs() {
    if (!dom.localTabs) return;
    const options = getLocalOptions(state.lockers);
    dom.localTabs.innerHTML = "";
    options.forEach((local) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "local-tab";
      button.dataset.local = local;
      button.textContent = local;
      const isActive = normalizeLocal(state.filters.local) === local;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      dom.localTabs.appendChild(button);
    });

    if (dom.localLabel) {
      dom.localLabel.textContent = state.filters.local || "--";
    }
  }

  function renderAreaItem(locker) {
    const meta = getStateMeta(locker.estado);
    const item = document.createElement("button");
    item.type = "button";
    item.className = "area-item";
    item.dataset.id = locker.id;
    item.style.setProperty("--state-color", locker.color_estado || meta.color);
    item.style.setProperty("--state-ink", meta.text);

    const main = document.createElement("div");
    main.className = "area-main";

    const person = document.createElement("div");
    person.className = "area-person";
    person.textContent = locker.colaborador_nombre || "Sin asignacion";

    const code = document.createElement("div");
    code.className = "area-code";
    code.textContent = locker.codigo || "--";

    main.appendChild(person);
    main.appendChild(code);

    const metaLine = document.createElement("div");
    metaLine.className = "area-meta-line";

    const stateBadge = document.createElement("div");
    stateBadge.className = "area-state";
    stateBadge.textContent = meta.label;

    const indicators = document.createElement("div");
    indicators.className = "area-indicators";

    const padlock = document.createElement("span");
    padlock.className = "area-indicator";
    if (locker.tiene_candado) padlock.classList.add("is-on");
    padlock.title = locker.tiene_candado ? "Tiene candado" : "Sin candado";
    const padlockIcon = document.createElement("i");
    padlockIcon.className = "fa-solid fa-lock";
    padlockIcon.setAttribute("aria-hidden", "true");
    padlock.appendChild(padlockIcon);

    const duplicate = document.createElement("span");
    duplicate.className = "area-indicator";
    if (locker.tiene_duplicado_llave) duplicate.classList.add("is-on");
    duplicate.title = locker.tiene_duplicado_llave ? "Tiene duplicado" : "Sin duplicado";
    const duplicateIcon = document.createElement("i");
    duplicateIcon.className = "fa-solid fa-key";
    duplicateIcon.setAttribute("aria-hidden", "true");
    duplicate.appendChild(duplicateIcon);

    indicators.appendChild(padlock);
    indicators.appendChild(duplicate);

    metaLine.appendChild(stateBadge);
    metaLine.appendChild(indicators);

    item.appendChild(main);
    item.appendChild(metaLine);

    const labelParts = [locker.colaborador_nombre || "Sin asignacion", locker.codigo || "--", meta.label];
    item.setAttribute("aria-label", labelParts.join(" - "));

    return item;
  }

  function renderAreaRow(locker) {
    const meta = getStateMeta(locker.estado);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "area-row";
    row.dataset.id = locker.id;
    row.style.setProperty("--state-color", locker.color_estado || meta.color);
    row.style.setProperty("--state-ink", meta.text);

    const main = document.createElement("div");
    main.className = "area-row-main";

    const name = document.createElement("div");
    name.className = "area-row-name";
    name.textContent = locker.colaborador_nombre || "Sin asignacion";

    const code = document.createElement("div");
    code.className = "area-row-code";
    code.textContent = locker.codigo || "--";

    main.appendChild(name);
    main.appendChild(code);

    const metaWrap = document.createElement("div");
    metaWrap.className = "area-row-meta";

    const stateBadge = document.createElement("div");
    stateBadge.className = "area-row-state";
    stateBadge.textContent = meta.label;

    const indicators = document.createElement("div");
    indicators.className = "area-row-indicators";

    const padlock = document.createElement("span");
    padlock.className = "area-indicator";
    if (locker.tiene_candado) padlock.classList.add("is-on");
    padlock.title = locker.tiene_candado ? "Tiene candado" : "Sin candado";
    const padlockIcon = document.createElement("i");
    padlockIcon.className = "fa-solid fa-lock";
    padlockIcon.setAttribute("aria-hidden", "true");
    padlock.appendChild(padlockIcon);

    const duplicate = document.createElement("span");
    duplicate.className = "area-indicator";
    if (locker.tiene_duplicado_llave) duplicate.classList.add("is-on");
    duplicate.title = locker.tiene_duplicado_llave ? "Tiene duplicado" : "Sin duplicado";
    const duplicateIcon = document.createElement("i");
    duplicateIcon.className = "fa-solid fa-key";
    duplicateIcon.setAttribute("aria-hidden", "true");
    duplicate.appendChild(duplicateIcon);

    indicators.appendChild(padlock);
    indicators.appendChild(duplicate);

    metaWrap.appendChild(stateBadge);
    metaWrap.appendChild(indicators);

    row.appendChild(main);
    row.appendChild(metaWrap);

    const labelParts = [locker.colaborador_nombre || "Sin asignacion", locker.codigo || "--", meta.label];
    row.setAttribute("aria-label", labelParts.join(" - "));

    return row;
  }

  function renderAreaList() {
    if (!dom.areaListView) return;
    const filtered = applyFilters(state.lockers, { estado: "ALL" });
    const assigned = filtered.filter((locker) => locker.colaborador_nombre);
    const areas = getAreaOptions(filtered);

    dom.areaListView.innerHTML = "";
    let groupsRendered = 0;
    areas.forEach((area) => {
      const group = document.createElement("section");
      group.className = "area-list-group";

      const header = document.createElement("div");
      header.className = "area-list-header";

      const title = document.createElement("div");
      title.className = "area-list-title";
      title.textContent = area;

      const list = document.createElement("div");
      list.className = "area-list-rows";

      const areaItems = sortLockers(
        assigned.filter((locker) => normalizeArea(locker.area) === area)
      );
      if (!areaItems.length) {
        return;
      }

      areaItems.forEach((locker) => list.appendChild(renderAreaRow(locker)));

      const count = document.createElement("div");
      count.className = "area-list-count";
      count.textContent = `${areaItems.length}`;

      header.appendChild(title);
      header.appendChild(count);
      group.appendChild(header);
      group.appendChild(list);
      dom.areaListView.appendChild(group);
      groupsRendered += 1;
    });

    if (!groupsRendered) {
      const empty = document.createElement("div");
      empty.className = "area-empty";
      empty.textContent = "Sin asignaciones en este local.";
      dom.areaListView.appendChild(empty);
    }
  }

  function renderAreaCards() {
    if (!dom.areaGrid) return;
    const filtered = applyFilters(state.lockers, { estado: "ALL" });
    const assigned = filtered.filter((locker) => locker.colaborador_nombre);
    const areas = getAreaOptions(filtered);

    dom.areaGrid.innerHTML = "";
    areas.forEach((area) => {
      const card = document.createElement("article");
      card.className = "area-card";

      const header = document.createElement("div");
      header.className = "area-card-header";

      const title = document.createElement("div");
      title.className = "area-card-title";
      title.textContent = area;

      const list = document.createElement("div");
      list.className = "area-list";

      const areaItems = sortLockers(
        assigned.filter((locker) => normalizeArea(locker.area) === area)
      );
      if (!areaItems.length) {
        const empty = document.createElement("div");
        empty.className = "area-empty";
        empty.textContent = "Sin asignaciones";
        list.appendChild(empty);
      } else {
        areaItems.forEach((locker) => list.appendChild(renderAreaItem(locker)));
      }

      const count = document.createElement("div");
      count.className = "area-card-count";
      count.textContent = `${areaItems.length}`;

      header.appendChild(title);
      header.appendChild(count);
      card.appendChild(header);
      card.appendChild(list);
      dom.areaGrid.appendChild(card);
    });

  }

  function renderSummary() {
    const list = applyFilters(state.lockers, { estado: "ALL" });
    const counts = {
      TOTAL: list.length,
      LIBRE: 0,
      SE_DESCONOCE: 0,
      OCUPADO: 0,
      MANTENIMIENTO: 0
    };

    list.forEach((locker) => {
      const key = normalizeEstado(locker.estado);
      if (counts[key] !== undefined) counts[key] += 1;
    });

    if (dom.totalCount) dom.totalCount.textContent = counts.TOTAL;
    if (dom.assignedCount) dom.assignedCount.textContent = counts.OCUPADO;
    if (dom.freeCount) dom.freeCount.textContent = counts.LIBRE;
    if (dom.unknownCount) dom.unknownCount.textContent = counts.SE_DESCONOCE;
    if (dom.maintenanceCount) dom.maintenanceCount.textContent = counts.MANTENIMIENTO;
  }

  function updateLegendActive() {
    if (!dom.legendChips) return;
    dom.legendChips.forEach((chip) => {
      const estado = chip.dataset.estado || "ALL";
      const isActive =
        (estado === "ALL" && state.filters.estado === "ALL") || estado === state.filters.estado;
      chip.classList.toggle("is-active", isActive);
      chip.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function buildStateMap(list) {
    const map = new Map();
    STATE_ORDER.forEach((key) => map.set(key, []));
    list.forEach((locker) => {
      const estado = normalizeEstado(locker.estado);
      if (!map.has(estado)) map.set(estado, []);
      map.get(estado).push(locker);
    });
    return map;
  }

  function resetVirtualization() {
    state.virtualization.enabled = state.lockers.length > 100;
    state.virtualization.limits = {};
    if (!state.virtualization.enabled) return;
    STATE_ORDER.forEach((key) => {
      state.virtualization.limits[key] = VIRTUAL_LIMIT;
    });
  }

  function getVirtualItems(estado, items) {
    if (!state.virtualization.enabled) return items;
    const limit = state.virtualization.limits[estado] || VIRTUAL_LIMIT;
    return items.slice(0, limit);
  }

  function getScrollPositions() {
    if (!dom.columnsContainer) return {};
    const positions = {};
    dom.columnsContainer.querySelectorAll(".status-column").forEach((column) => {
      const key = column.dataset.estado;
      const scroll = column.querySelector(".status-scroll");
      if (key && scroll) positions[key] = scroll.scrollTop;
    });
    return positions;
  }

  function restoreScrollPositions(positions) {
    if (!dom.columnsContainer) return;
    dom.columnsContainer.querySelectorAll(".status-column").forEach((column) => {
      const key = column.dataset.estado;
      const scroll = column.querySelector(".status-scroll");
      if (key && scroll && positions[key] !== undefined) {
        scroll.scrollTop = positions[key];
      }
    });
  }
  function renderSkeletonColumn(estadoKey) {
    const meta = STATE_META[estadoKey];
    const column = document.createElement("section");
    column.className = "status-column";
    column.dataset.estado = estadoKey;
    column.style.setProperty("--state-color", meta.color);
    column.style.setProperty("--state-ink", meta.text);
    column.style.setProperty("--state-tint", hexToRgba(meta.color, 0.08));

    const header = document.createElement("div");
    header.className = "status-column-header";
    const title = document.createElement("div");
    title.className = "status-title";
    const dot = document.createElement("span");
    dot.className = "status-dot";
    const label = document.createElement("span");
    label.textContent = meta.label;
    title.appendChild(dot);
    title.appendChild(label);
    const count = document.createElement("span");
    count.className = "status-count";
    count.textContent = "--";
    header.appendChild(title);
    header.appendChild(count);

    const scroll = document.createElement("div");
    scroll.className = "status-scroll";
    const list = document.createElement("div");
    list.className = "status-list";
    for (let i = 0; i < 4; i += 1) {
      const card = document.createElement("div");
      card.className = "skeleton-card";
      list.appendChild(card);
    }
    scroll.appendChild(list);

    column.appendChild(header);
    column.appendChild(scroll);
    return column;
  }

  function renderStatusColumn(estadoKey, items) {
    const meta = STATE_META[estadoKey];
    const isCollapsed = !!state.collapsedStates[estadoKey];
    const column = document.createElement("section");
    column.className = "status-column";
    column.dataset.estado = estadoKey;
    column.dataset.total = String(items.length);
    column.style.setProperty("--state-color", meta.color);
    column.style.setProperty("--state-ink", meta.text);
    column.style.setProperty("--state-tint", hexToRgba(meta.color, 0.08));
    column.classList.toggle("is-collapsed", isCollapsed);
    if (state.loadingColumns.has(estadoKey)) column.classList.add("is-loading");

    const header = document.createElement("div");
    header.className = "status-column-header";

    const title = document.createElement("div");
    title.className = "status-title";
    const dot = document.createElement("span");
    dot.className = "status-dot";
    const label = document.createElement("span");
    label.textContent = meta.label;
    title.appendChild(dot);
    title.appendChild(label);

    const count = document.createElement("span");
    count.className = "status-count";
    count.textContent = `${items.length}`;

    const actions = document.createElement("div");
    actions.className = "status-actions";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "column-toggle";
    toggle.dataset.estado = estadoKey;
    toggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    toggle.setAttribute("aria-label", isCollapsed ? "Expandir columna" : "Colapsar columna");
    const toggleIcon = document.createElement("span");
    toggleIcon.textContent = ">";
    toggle.appendChild(toggleIcon);

    actions.appendChild(count);
    actions.appendChild(toggle);

    header.appendChild(title);
    header.appendChild(actions);

    if (isCollapsed) {
      column.appendChild(header);
      return column;
    }

    const scroll = document.createElement("div");
    scroll.className = "status-scroll";

    const list = document.createElement("div");
    list.className = "status-list";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Sin lockers en este estado.";
      list.appendChild(empty);
    } else {
      const sorted = sortLockers(items);
      const visible = getVirtualItems(estadoKey, sorted);
      visible.forEach((locker) => list.appendChild(renderLockerCard(locker)));
      if (state.virtualization.enabled && sorted.length > visible.length) {
        const more = document.createElement("div");
        more.className = "empty-state";
        more.textContent = "Desliza para cargar mas";
        list.appendChild(more);
      }
    }

    scroll.appendChild(list);
    column.appendChild(header);
    column.appendChild(scroll);

    return column;
  }

  function renderLockerCard(locker) {
    const meta = getStateMeta(locker.estado);
    const searchValue = String(state.filters.search || "").trim();
    const estado = normalizeEstado(locker.estado);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "locker-card";
    card.dataset.id = locker.id;
    card.dataset.estado = estado;
    card.style.setProperty("--state-color", locker.color_estado || meta.color);
    card.style.setProperty("--state-ink", meta.text);
    if (locker.id === state.selectedId) card.classList.add("is-selected");
    if (state.updatedIds.has(locker.id)) card.classList.add("is-updated");

    const stateLabel = document.createElement("div");
    stateLabel.className = "card-state";
    stateLabel.textContent = meta.label;

    const code = document.createElement("div");
    code.className = "card-code";
    code.innerHTML = highlightText(locker.codigo || "--", searchValue);

    const assignee = document.createElement("div");
    assignee.className = "card-assignee";
    if (locker.colaborador_nombre) {
      assignee.innerHTML = highlightText(locker.colaborador_nombre, searchValue);
    } else {
      assignee.textContent = meta.hint;
      assignee.classList.add("is-muted");
    }

    const iconWrap = document.createElement("div");
    iconWrap.className = "card-icon";
    const icon = document.createElement("i");
    const iconClass = locker.icono_estado || meta.icon;
    icon.className = `fa-solid ${iconClass}`;
    icon.setAttribute("aria-hidden", "true");
    iconWrap.appendChild(icon);

    card.appendChild(stateLabel);
    card.appendChild(code);
    card.appendChild(assignee);
    card.appendChild(iconWrap);

    const labelParts = [locker.codigo || "--", meta.label];
    if (locker.colaborador_nombre) labelParts.push(locker.colaborador_nombre);
    card.setAttribute("aria-label", labelParts.join(" - "));
    card.setAttribute("aria-pressed", locker.id === state.selectedId ? "true" : "false");

    return card;
  }

  function renderColumns() {
    if (!dom.columnsContainer) return;
    const filtered = applyFilters(state.lockers);
    const scrollPositions = getScrollPositions();
    const statesToRender = STATE_ORDER;
    const mapCountValue = filtered.filter((locker) =>
      statesToRender.includes(normalizeEstado(locker.estado))
    ).length;

    if (dom.mapCount) {
      dom.mapCount.textContent = `${mapCountValue} lockers`;
    }

    dom.columnsContainer.innerHTML = "";
    dom.columnsContainer.setAttribute("aria-busy", state.loading ? "true" : "false");

    if (state.loading) {
      statesToRender.forEach((key) => {
        dom.columnsContainer.appendChild(renderSkeletonColumn(key));
      });
      return;
    }

    const stateMap = buildStateMap(filtered);
    statesToRender.forEach((estadoKey) => {
      const items = stateMap.get(estadoKey) || [];
      dom.columnsContainer.appendChild(renderStatusColumn(estadoKey, items));
    });

    restoreScrollPositions(scrollPositions);
    setupVirtualScroll();
  }
  function renderSelected() {
    const locker = getSelectedLocker();
    const hasSelection = !!locker;
    if (dom.panelTitle) dom.panelTitle.textContent = "Detalle del locker";
    dom.selectedHint.textContent = hasSelection
      ? "Edita la ficha o ejecuta una accion rapida."
      : "Selecciona un locker del mapa.";

    dom.assignBtn.disabled = !hasSelection;
    dom.releaseBtn.disabled = !hasSelection;
    dom.blockBtn.disabled = !hasSelection;
    dom.nameInput.disabled = !hasSelection;
    dom.dateInput.disabled = !hasSelection;
    dom.areaSelect.disabled = !hasSelection;
    dom.localSelect.disabled = !hasSelection;
    dom.hasPadlock.disabled = !hasSelection;
    dom.hasDuplicateKey.disabled = !hasSelection;

    setPanelOpen(hasSelection && !state.panelLocked);

    if (!hasSelection) {
      dom.selectedCode.textContent = "--";
      dom.nameInput.value = "";
      dom.dateInput.value = "";
      dom.hasPadlock.checked = false;
      dom.hasDuplicateKey.checked = false;
      if (dom.localSelect) {
        dom.localSelect.value =
          state.filters.local || dom.localSelect.options[0]?.value || "";
      }
      dom.selectedStateBadge.style.setProperty("--state-color", "#9ca3af");
      dom.selectedStateBadge.style.setProperty("--state-ink", "#ffffff");
      dom.selectedStateLabel.textContent = "Sin seleccion";
      dom.assignBtn.textContent = "Asignar";
      dom.releaseBtn.textContent = "Liberar";
      dom.blockBtn.textContent = "Bloquear";
      dom.assignBtn.classList.remove("is-primary");
      dom.releaseBtn.classList.remove("is-primary");
      dom.blockBtn.classList.remove("is-primary");
      return;
    }

    const meta = getStateMeta(locker.estado);
    dom.selectedCode.textContent = locker.codigo || "--";
    dom.nameInput.value = locker.colaborador_nombre || "";
    dom.dateInput.value = locker.fecha_asignacion || "";

    if (locker.area) {
      dom.areaSelect.value = normalizeArea(locker.area);
    } else if (dom.areaSelect.options.length) {
      dom.areaSelect.value = dom.areaSelect.options[0].value;
    }
    if (locker.local) {
      dom.localSelect.value = normalizeLocal(locker.local);
    } else if (state.filters.local) {
      dom.localSelect.value = state.filters.local;
    } else if (dom.localSelect.options.length) {
      dom.localSelect.value = dom.localSelect.options[0].value;
    }
    dom.hasPadlock.checked = Boolean(locker.tiene_candado);
    dom.hasDuplicateKey.checked = Boolean(locker.tiene_duplicado_llave);
    dom.selectedStateBadge.style.setProperty("--state-color", locker.color_estado || meta.color);
    dom.selectedStateBadge.style.setProperty("--state-ink", meta.text);
    dom.selectedStateLabel.textContent = meta.label;

    updateActionButtons(locker);
  }

  function updateActionButtons(locker) {
    const estado = normalizeEstado(locker.estado);
    let primary = "assign";

    if (estado === "OCUPADO") primary = "release";
    if (estado === "BLOQUEADO") primary = "block";
    if (estado === "MANTENIMIENTO") primary = "release";

    dom.assignBtn.classList.toggle("is-primary", primary === "assign");
    dom.releaseBtn.classList.toggle("is-primary", primary === "release");
    dom.blockBtn.classList.toggle("is-primary", primary === "block");

    dom.assignBtn.textContent = estado === "SE_DESCONOCE" ? "Regularizar" : "Asignar";
    dom.blockBtn.textContent = estado === "BLOQUEADO" ? "Desbloquear" : "Bloquear";
  }

  function renderAll() {
    ensureLocalSelection();
    renderLocalTabs();
    updateViewModeUI();
    renderAreaList();
    renderSummary();
    renderColumns();
    renderSelected();
    updateLegendActive();
  }

  function markUpdated(id) {
    if (!id) return;
    state.updatedIds.add(id);
    clearTimeout(state.updateTimers.get(id));
    const timer = setTimeout(() => {
      state.updatedIds.delete(id);
      state.updateTimers.delete(id);
      renderColumns();
    }, 1500);
    state.updateTimers.set(id, timer);
  }

  async function updateLocker(id, payload, successMessage) {
    const current = state.lockers.find((locker) => locker.id === id);
    const currentState = current ? normalizeEstado(current.estado) : null;
    const targetState = payload.estado ? normalizeEstado(payload.estado) : currentState;
    state.loadingColumns = new Set([currentState, targetState].filter(Boolean));
    renderColumns();

    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Supabase no esta disponible.", "error");
      state.loadingColumns = new Set();
      renderColumns();
      return null;
    }
    setStatus("Guardando cambios...", "info");

    const { data, error } = await supabase
      .from("lockers")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      setStatus(`Error al guardar: ${error.message || error}`, "error");
      state.loadingColumns = new Set();
      renderColumns();
      return null;
    }

    const index = state.lockers.findIndex((locker) => locker.id === id);
    if (index >= 0) state.lockers[index] = data;
    else state.lockers.push(data);

    ensureAreaSelectOptions(state.lockers);
    ensureLocalSelectOptions(state.lockers);
    markUpdated(id);
    state.loadingColumns = new Set();
    renderAll();
    setStatus(successMessage || "Locker actualizado.", "success");
    return data;
  }
  async function handleAssign() {
    const locker = getSelectedLocker();
    if (!locker) {
      setStatus("Selecciona un locker para continuar.", "warn");
      return;
    }

    const name = dom.nameInput.value.trim();
    if (!name) {
      setStatus("Ingresa un nombre para asignar.", "warn");
      dom.nameInput.focus();
      return;
    }

    const date = dom.dateInput.value || new Date().toISOString().slice(0, 10);
    const area = dom.areaSelect.value || normalizeArea(locker.area) || AREA_BASE[0];
    const local =
      normalizeLocal(dom.localSelect.value) ||
      normalizeLocal(locker.local) ||
      state.filters.local ||
      LOCAL_BASE[0];
    const occupiedMeta = STATE_META.OCUPADO;

    const payload = {
      area,
      local,
      updated_at: new Date().toISOString(),
      colaborador_nombre: name,
      fecha_asignacion: date || null,
      estado: "OCUPADO",
      color_estado: occupiedMeta.color,
      icono_estado: occupiedMeta.icon,
      tiene_candado: dom.hasPadlock.checked,
      tiene_duplicado_llave: dom.hasDuplicateKey.checked
    };

    await updateLocker(locker.id, payload, "Locker asignado.");
  }

  async function handleRelease() {
    const locker = getSelectedLocker();
    if (!locker) {
      setStatus("Selecciona un locker para continuar.", "warn");
      return;
    }

    const libreMeta = STATE_META.LIBRE;
    const local =
      normalizeLocal(dom.localSelect.value) ||
      normalizeLocal(locker.local) ||
      state.filters.local ||
      LOCAL_BASE[0];
    const payload = {
      colaborador_nombre: null,
      fecha_asignacion: null,
      estado: "LIBRE",
      color_estado: libreMeta.color,
      icono_estado: libreMeta.icon,
      area: dom.areaSelect.value || normalizeArea(locker.area) || AREA_BASE[0],
      local,
      tiene_candado: false,
      tiene_duplicado_llave: false,
      updated_at: new Date().toISOString()
    };

    await updateLocker(locker.id, payload, "Locker liberado.");
  }

  async function handleToggleBlock() {
    const locker = getSelectedLocker();
    if (!locker) {
      setStatus("Selecciona un locker para continuar.", "warn");
      return;
    }

    const local =
      normalizeLocal(dom.localSelect.value) ||
      normalizeLocal(locker.local) ||
      state.filters.local ||
      LOCAL_BASE[0];
    const estado = normalizeEstado(locker.estado);
    if (estado === "BLOQUEADO") {
      const target = locker.colaborador_nombre ? "OCUPADO" : "LIBRE";
      const meta = STATE_META[target] || STATE_META.LIBRE;
      const payload = {
        estado: target,
        color_estado: meta.color,
        icono_estado: meta.icon,
        area: dom.areaSelect.value || normalizeArea(locker.area) || AREA_BASE[0],
        local,
        updated_at: new Date().toISOString()
      };
      if (!locker.colaborador_nombre) {
        payload.colaborador_nombre = null;
        payload.fecha_asignacion = null;
      }
      await updateLocker(locker.id, payload, "Locker desbloqueado.");
      return;
    }

    const blockedMeta = STATE_META.BLOQUEADO;
    const payload = {
      estado: "BLOQUEADO",
      color_estado: blockedMeta.color,
      icono_estado: blockedMeta.icon,
      area: dom.areaSelect.value || normalizeArea(locker.area) || AREA_BASE[0],
      local,
      updated_at: new Date().toISOString()
    };

    await updateLocker(locker.id, payload, "Locker bloqueado.");
  }

  function setPanelOpen(open) {
    if (!dom.root) return;
    dom.root.classList.toggle("panel-open", open);
    dom.panel?.setAttribute("aria-hidden", open ? "false" : "true");
    dom.panelBackdrop?.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function handleLocalTabClick(event) {
    const button = event.target.closest(".local-tab");
    if (!button) return;
    setLocalFilter(button.dataset.local);
  }

  function handleViewToggle(event) {
    const toggle = event.target.closest(".view-tab");
    if (!toggle) return;
    setViewMode(toggle.dataset.view);
    renderAll();
  }

  function handleAreaItemClick(event) {
    const item = event.target.closest(".area-item, .area-row");
    if (!item) return;
    state.panelLocked = false;
    state.selectedId = item.dataset.id;
    closeQuickMenu();
    renderAll();
  }

  function handleLegendFilter(estado) {
    if (!estado || estado === "ALL") {
      state.filters.estado = "ALL";
    } else {
      state.filters.estado = state.filters.estado === estado ? "ALL" : estado;
    }
    renderAll();
  }

  function handleColumnToggle(event) {
    const toggle = event.target.closest(".column-toggle");
    if (!toggle) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const estado = toggle.dataset.estado;
    if (!estado) return;
    state.collapsedStates[estado] = !state.collapsedStates[estado];
    saveCollapseState();
    renderColumns();
  }

  function handleCardClick(event) {
    if (state.suppressClick) {
      state.suppressClick = false;
      return;
    }
    const card = event.target.closest(".locker-card");
    if (!card) return;
    state.panelLocked = false;
    state.selectedId = card.dataset.id;
    closeQuickMenu();
    renderAll();
  }

  function handlePointerDown(event) {
    const card = event.target.closest(".locker-card");
    if (!card) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      state.suppressClick = true;
      state.selectedId = card.dataset.id;
      openQuickMenu(card.dataset.id, event);
      renderColumns();
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handlePointerUp() {
    cancelLongPress();
  }

  function handleCardKeydown(event) {
    const keys = ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"];
    if (!keys.includes(event.key)) return;
    const card = event.target.closest(".locker-card");
    if (!card) return;

    const column = card.closest(".status-column");
    if (!column) return;

    const columns = Array.from(dom.columnsContainer.querySelectorAll(".status-column"));
    const columnIndex = columns.indexOf(column);
    const cards = Array.from(column.querySelectorAll(".locker-card"));
    const index = cards.indexOf(card);

    let target = null;
    if (event.key === "ArrowDown") target = cards[index + 1] || cards[index];
    if (event.key === "ArrowUp") target = cards[index - 1] || cards[index];
    if (event.key === "ArrowRight") {
      const nextColumn = columns[columnIndex + 1];
      if (nextColumn) {
        const nextCards = Array.from(nextColumn.querySelectorAll(".locker-card"));
        target = nextCards[Math.min(index, nextCards.length - 1)] || nextCards[0];
      }
    }
    if (event.key === "ArrowLeft") {
      const prevColumn = columns[columnIndex - 1];
      if (prevColumn) {
        const prevCards = Array.from(prevColumn.querySelectorAll(".locker-card"));
        target = prevCards[Math.min(index, prevCards.length - 1)] || prevCards[0];
      }
    }

    if (target) {
      event.preventDefault();
      target.focus();
    }
  }

  function openQuickMenu(id, event) {
    if (!dom.quickMenu) return;
    state.quickMenu.open = true;
    state.quickMenu.lockerId = id;
    state.panelLocked = true;
    setPanelOpen(false);

    const locker = getSelectedLocker();
    if (locker) {
      const estado = normalizeEstado(locker.estado);
      dom.quickAssign.textContent = estado === "SE_DESCONOCE" ? "Regularizar" : "Asignar";
      dom.quickBlock.textContent = estado === "BLOQUEADO" ? "Desbloquear" : "Bloquear";
    }

    const x = event?.clientX || window.innerWidth / 2;
    const y = event?.clientY || window.innerHeight / 2;
    dom.quickMenu.style.setProperty("--menu-x", `${x}px`);
    dom.quickMenu.style.setProperty("--menu-y", `${y}px`);
    dom.quickMenu.classList.add("is-open");
    dom.quickMenu.setAttribute("aria-hidden", "false");
  }

  function closeQuickMenu() {
    if (!dom.quickMenu) return;
    state.quickMenu.open = false;
    dom.quickMenu.classList.remove("is-open");
    dom.quickMenu.setAttribute("aria-hidden", "true");
  }

  function handleQuickAssign() {
    closeQuickMenu();
    state.panelLocked = false;
    renderSelected();
    dom.nameInput?.focus();
  }

  function handleQuickRelease() {
    closeQuickMenu();
    state.panelLocked = false;
    handleRelease();
  }

  function handleQuickBlock() {
    closeQuickMenu();
    state.panelLocked = false;
    handleToggleBlock();
  }

  function handlePanelClose() {
    state.selectedId = null;
    state.panelLocked = false;
    renderAll();
  }

  function handleSearchInput(event) {
    const value = event.target.value.trim();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.filters.search = value;
      renderAll();
    }, 150);
  }

  function getVisibleLockersByState(estado) {
    const filtered = applyFilters(state.lockers);
    const sameState = filtered.filter((locker) => normalizeEstado(locker.estado) === estado);
    return sortLockers(sameState);
  }

  function selectAdjacentInState(direction) {
    const locker = getSelectedLocker();
    if (!locker) return;
    const estado = normalizeEstado(locker.estado);
    const list = getVisibleLockersByState(estado);
    const index = list.findIndex((item) => item.id === locker.id);
    if (index === -1) return;
    const next = list[index + direction];
    if (!next) return;
    state.selectedId = next.id;
    renderAll();
  }

  function handlePanelTouchStart(event) {
    if (event.target.closest("input, select, textarea, button")) return;
    const touch = event.touches[0];
    if (!touch) return;
    state.touchStart = {
      x: touch.clientX,
      y: touch.clientY
    };
  }

  function handlePanelTouchEnd(event) {
    if (!state.touchStart) return;
    if (!dom.root?.classList.contains("panel-open")) {
      state.touchStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - state.touchStart.x;
    const deltaY = touch.clientY - state.touchStart.y;
    state.touchStart = null;

    if (Math.abs(deltaY) > 60 && Math.abs(deltaY) > Math.abs(deltaX)) {
      const cardScrollTop = dom.panelCard ? dom.panelCard.scrollTop : 0;
      if (deltaY > 0 && cardScrollTop <= 0) handlePanelClose();
      return;
    }

    if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) selectAdjacentInState(1);
      if (deltaX > 0) selectAdjacentInState(-1);
    }
  }
  function setupVirtualScroll() {
    if (!state.virtualization.enabled) return;
    const scrolls = dom.columnsContainer.querySelectorAll(".status-scroll");
    scrolls.forEach((scroll) => {
      scroll.addEventListener(
        "scroll",
        (event) => {
          const column = event.currentTarget.closest(".status-column");
          if (!column) return;
          const estado = column.dataset.estado;
          const total = Number(column.dataset.total || "0");
          const limit = state.virtualization.limits[estado] || VIRTUAL_LIMIT;
          if (limit >= total) return;
          if (
            event.currentTarget.scrollTop + event.currentTarget.clientHeight <
            event.currentTarget.scrollHeight - 24
          ) {
            return;
          }
          state.virtualization.limits[estado] = limit + VIRTUAL_STEP;
          renderColumns();
        },
        { passive: true }
      );
    });
  }

  function bindEvents() {
    dom.searchInput.addEventListener("input", handleSearchInput);
    dom.assignBtn.addEventListener("click", handleAssign);
    dom.releaseBtn.addEventListener("click", handleRelease);
    dom.blockBtn.addEventListener("click", handleToggleBlock);
    dom.panelClose.addEventListener("click", handlePanelClose);
    dom.panelBackdrop.addEventListener("click", handlePanelClose);
    dom.localTabs?.addEventListener("click", handleLocalTabClick);
    dom.viewTabs?.addEventListener("click", handleViewToggle);
    dom.areaGrid?.addEventListener("click", handleAreaItemClick);
    dom.areaListView?.addEventListener("click", handleAreaItemClick);
    dom.panelCard?.addEventListener("touchstart", handlePanelTouchStart, { passive: true });
    dom.panelCard?.addEventListener("touchend", handlePanelTouchEnd, { passive: true });
    dom.panelCard?.addEventListener("touchcancel", handlePanelTouchEnd, { passive: true });

    dom.columnsContainer.addEventListener("click", handleColumnToggle);
    dom.columnsContainer.addEventListener("click", handleCardClick);
    dom.columnsContainer.addEventListener("keydown", handleCardKeydown);
    dom.columnsContainer.addEventListener("pointerdown", handlePointerDown);
    dom.columnsContainer.addEventListener("pointerup", handlePointerUp);
    dom.columnsContainer.addEventListener("pointercancel", handlePointerUp);
    dom.columnsContainer.addEventListener("pointerleave", handlePointerUp);

    dom.legendContainer?.addEventListener("click", (event) => {
      const chip = event.target.closest(".hero-chip[data-estado]");
      if (!chip) return;
      handleLegendFilter(chip.dataset.estado);
    });

    dom.quickAssign.addEventListener("click", handleQuickAssign);
    dom.quickRelease.addEventListener("click", handleQuickRelease);
    dom.quickBlock.addEventListener("click", handleQuickBlock);

    document.addEventListener("click", (event) => {
      if (state.quickMenu.open && dom.quickMenu && !dom.quickMenu.contains(event.target)) {
        closeQuickMenu();
        state.panelLocked = false;
      }
    });

    window.addEventListener("scroll", handleHeaderScroll, { passive: true });
  }
  async function loadLockers(force = false) {
    setStatus("Cargando lockers...", "info");
    state.loading = true;
    state.loadingColumns = new Set();
    renderColumns();

    const supabase = await waitForSupabase();
    if (!supabase) {
      state.lockers = [];
      state.loading = false;
      unsubscribeRealtime();
      ensureAreaSelectOptions(state.lockers);
      ensureLocalSelectOptions(state.lockers);
      resetVirtualization();
      state.selectedId = null;
      renderAll();
      setStatus("Supabase no disponible. Sin datos.", "warn");
      return;
    }

    const { data, error } = await supabase
      .from("lockers")
      .select("*")
      .order("codigo", { ascending: true });

    if (error) {
      console.error(error);
      state.lockers = [];
      state.loading = false;
      unsubscribeRealtime();
      ensureAreaSelectOptions(state.lockers);
      ensureLocalSelectOptions(state.lockers);
      resetVirtualization();
      state.selectedId = null;
      renderAll();
      setStatus("No se pudo cargar lockers.", "warn");
      return;
    }

    const list = Array.isArray(data) ? data : [];
    if (!list.length) {
      state.lockers = [];
      state.loading = false;
      unsubscribeRealtime();
      setStatus("Sin lockers en la base.", "warn");
    } else {
      state.lockers = list;
      state.loading = false;
      if (!state.channel || force) {
        subscribeToRealtime(supabase);
      }
      setStatus("Datos actualizados.", "success");
    }

    ensureAreaSelectOptions(state.lockers);
    ensureLocalSelectOptions(state.lockers);
    resetVirtualization();
    if (!state.lockers.find((locker) => locker.id === state.selectedId)) {
      state.selectedId = null;
    }
    renderAll();
  }

  function applyRealtimePayload(payload) {
    if (!payload) return;
    const { eventType } = payload;
    const newRow = payload.new;
    const oldRow = payload.old;

    if (eventType === "INSERT" && newRow) {
      state.lockers.push(newRow);
      markUpdated(newRow.id);
    }
    if (eventType === "UPDATE" && newRow) {
      const index = state.lockers.findIndex((locker) => locker.id === newRow.id);
      if (index >= 0) state.lockers[index] = newRow;
      else state.lockers.push(newRow);
      markUpdated(newRow.id);
    }
    if (eventType === "DELETE" && oldRow) {
      state.lockers = state.lockers.filter((locker) => locker.id !== oldRow.id);
      if (state.selectedId === oldRow.id) state.selectedId = null;
    }

    ensureAreaSelectOptions(state.lockers);
    ensureLocalSelectOptions(state.lockers);
    resetVirtualization();
    renderAll();
  }

  function unsubscribeRealtime() {
    if (!state.channel) return;
    try {
      state.channel.unsubscribe();
    } catch (err) {
      // ignore
    }
    state.channel = null;
  }

  function subscribeToRealtime(supabase) {
    unsubscribeRealtime();

    state.channel = supabase
      .channel("lockers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lockers" },
        (payload) => applyRealtimePayload(payload)
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setStatus("Canal en tiempo real activo.", "success");
        }
      });
  }

  function teardown() {
    state.active = false;
    unsubscribeRealtime();
  }

  function cacheDom(root) {
    dom = {
      root,
      searchInput: root.querySelector("#lockerSearch"),
      mapCount: root.querySelector("#lockerMapCount"),
      columnsContainer: root.querySelector("#lockerStatusColumns"),
      selectedHint: root.querySelector("#lockerSelectedHint"),
      selectedCode: root.querySelector("#lockerSelectedCode"),
      selectedStateBadge: root.querySelector("#lockerSelectedStateBadge"),
      selectedStateLabel: root.querySelector("#lockerSelectedStateLabel"),
      nameInput: root.querySelector("#lockerName"),
      dateInput: root.querySelector("#lockerDate"),
      areaSelect: root.querySelector("#lockerGroup"),
      localSelect: root.querySelector("#lockerLocal"),
      hasPadlock: root.querySelector("#lockerHasPadlock"),
      hasDuplicateKey: root.querySelector("#lockerHasDuplicateKey"),
      assignBtn: root.querySelector("#lockerAssignBtn"),
      releaseBtn: root.querySelector("#lockerReleaseBtn"),
      blockBtn: root.querySelector("#lockerBlockBtn"),
      totalCount: root.querySelector("#lockerTotalCount"),
      assignedCount: root.querySelector("#lockerAssignedCount"),
      freeCount: root.querySelector("#lockerFreeCount"),
      unknownCount: root.querySelector("#lockerUnknownCount"),
      maintenanceCount: root.querySelector("#lockerMaintenanceCount"),
      legendContainer: root.querySelector(".hero-meta"),
      legendChips: Array.from(root.querySelectorAll(".hero-chip[data-estado]")),
      panel: root.querySelector("#lockerDetailPanel"),
      panelCard: root.querySelector(".panel-card"),
      panelTitle: root.querySelector("#lockerPanelTitle"),
      panelClose: root.querySelector("#lockerPanelClose"),
      panelBackdrop: root.querySelector("#lockerPanelBackdrop"),
      toast: root.querySelector("#lockerToast"),
      quickMenu: root.querySelector("#lockerQuickMenu"),
      quickAssign: root.querySelector("#lockerQuickAssign"),
      quickRelease: root.querySelector("#lockerQuickRelease"),
      quickBlock: root.querySelector("#lockerQuickBlock"),
      localTabs: root.querySelector("#lockerLocalTabs"),
      viewTabs: root.querySelector("#lockerViewTabs"),
      viewToggles: Array.from(root.querySelectorAll(".view-tab[data-view]")),
      localLabel: root.querySelector("#lockerLocalLabel"),
      areaGrid: root.querySelector("#lockerAreaGrid"),
      areaListView: root.querySelector("#lockerAreaListView"),
      assignmentBoard: root.querySelector("#lockerAssignmentBoard"),
      stateBoard: root.querySelector("#lockerStateBoard")
    };
  }

  function init() {
    const root = document.querySelector("[data-lockers-view]");
    if (!root) {
      if (state.active) teardown();
      return;
    }
    if (root.dataset.lockersInit === "true") return;
    root.dataset.lockersInit = "true";
    state.active = true;

    state.initialLocal = normalizeLocal(getLocalFromUrl());
    state.localManual = false;
    cacheDom(root);
    const savedView = readViewMode();
    state.viewMode = savedView === "states" ? "states" : "assignments";
    updateViewModeUI();
    state.collapsedStates = readCollapseState();
    ensureAreaSelectOptions(state.lockers);
    ensureLocalSelectOptions(state.lockers);
    renderAll();
    bindEvents();
    handleHeaderScroll();
    loadLockers();
  }

  init();
  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("partial:loaded", init);
})();
