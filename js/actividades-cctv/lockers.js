(() => {
  const GROUP_ORDER = ["LLENOS", "LCL", "MAQUINARIAS"];
  const STATE_META = {
    LIBRE: {
      label: "Libre",
      color: "#11b4d7",
      icon: "fa-unlock",
      hint: "Disponible"
    },
    OCUPADO: {
      label: "Ocupado",
      color: "#f2c94c",
      icon: "fa-lock",
      hint: "Asignado"
    },
    MANTENIMIENTO: {
      label: "Mantenimiento",
      color: "#64748b",
      icon: "fa-screwdriver-wrench",
      hint: "Revision"
    },
    BLOQUEADO: {
      label: "Bloqueado",
      color: "#ef4444",
      icon: "fa-ban",
      hint: "No disponible"
    }
  };
  const STATE_ORDER = ["LIBRE", "OCUPADO", "MANTENIMIENTO", "BLOQUEADO"];

  const state = {
    lockers: [],
    selectedId: null,
    filters: {
      search: "",
      estado: "ALL",
      grupo: "ALL",
      showInactive: false
    },
    channel: null,
    active: false
  };

  let dom = {};
  let searchTimer = null;

  function getSupabaseClient() {
    const candidate = window?.supabase;
    if (candidate && typeof candidate.from === "function") return candidate;
    const client = window?.supabaseClient || window?.SUPABASE_CLIENT || window?.__supabase_client__;
    if (client && typeof client.from === "function") return client;
    return null;
  }

  function waitForSupabase(maxAttempts = 40, waitMs = 250) {
    return new Promise((resolve) => {
      let attempts = 0;
      const timer = setInterval(() => {
        const client = getSupabaseClient();
        if (client) {
          clearInterval(timer);
          resolve(client);
          return;
        }
        attempts += 1;
        if (attempts >= maxAttempts) {
          clearInterval(timer);
          resolve(null);
        }
      }, waitMs);
    });
  }

  function normalizeEstado(value) {
    if (!value) return "LIBRE";
    return String(value).trim().toUpperCase();
  }

  function normalizeGrupo(value) {
    if (!value) return "SIN_GRUPO";
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

  function setStatus(message, type = "info") {
    if (!dom.status) return;
    dom.status.textContent = message;
    dom.status.classList.remove("success", "error", "warn");
    if (type === "success") dom.status.classList.add("success");
    if (type === "error") dom.status.classList.add("error");
    if (type === "warn") dom.status.classList.add("warn");
  }

  function getSelectedLocker() {
    return state.lockers.find((locker) => locker.id === state.selectedId) || null;
  }

  function applyFilters(list) {
    const search = state.filters.search;
    const estado = state.filters.estado;
    const grupo = state.filters.grupo;
    const showInactive = state.filters.showInactive;

    return list.filter((locker) => {
      if (!showInactive && locker.activo === false) return false;

      const lockerEstado = normalizeEstado(locker.estado);
      const lockerGrupo = normalizeGrupo(locker.grupo);

      if (estado !== "ALL" && lockerEstado !== estado) return false;
      if (grupo !== "ALL" && lockerGrupo !== grupo) return false;

      if (!search) return true;
      const haystack = [
        locker.codigo,
        locker.colaborador_nombre,
        locker.colaborador_dni,
        locker.observaciones
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .join(" ");
      return haystack.includes(search);
    });
  }

  function getGroupOptions(lockers) {
    const dynamic = new Set();
    lockers.forEach((locker) => {
      const group = normalizeGrupo(locker.grupo);
      if (group) dynamic.add(group);
    });
    const extras = Array.from(dynamic).filter((group) => !GROUP_ORDER.includes(group)).sort();
    return [...GROUP_ORDER, ...extras];
  }

  function ensureGroupSelectOptions(lockers) {
    if (!dom.groupSelect || !dom.groupFilter) return;

    const options = getGroupOptions(lockers);
    const currentSelect = dom.groupSelect.value;

    dom.groupSelect.innerHTML = "";
    options.forEach((group) => {
      const option = document.createElement("option");
      option.value = group;
      option.textContent = group;
      dom.groupSelect.appendChild(option);
    });

    if (currentSelect) {
      dom.groupSelect.value = currentSelect;
    }

    const current = dom.groupFilter.value;
    dom.groupFilter.innerHTML = "";
    const allOption = document.createElement("option");
    allOption.value = "ALL";
    allOption.textContent = "Grupo: Todos";
    dom.groupFilter.appendChild(allOption);

    options.forEach((group) => {
      const option = document.createElement("option");
      option.value = group;
      option.textContent = group;
      dom.groupFilter.appendChild(option);
    });

    if (current) {
      dom.groupFilter.value = current;
    }
  }

  function renderLegend() {
    if (!dom.legendGrid) return;
    dom.legendGrid.innerHTML = "";

    STATE_ORDER.forEach((key) => {
      const meta = STATE_META[key];
      const item = document.createElement("button");
      item.type = "button";
      item.className = "legend-item";
      item.dataset.estado = key;
      item.style.setProperty("--legend-color", meta.color);

      const swatch = document.createElement("div");
      swatch.className = "legend-swatch";
      const icon = document.createElement("i");
      icon.className = `fa-solid ${meta.icon}`;
      icon.setAttribute("aria-hidden", "true");
      swatch.appendChild(icon);

      const text = document.createElement("div");
      text.className = "legend-text";
      const title = document.createElement("strong");
      title.textContent = meta.label;
      const hint = document.createElement("span");
      hint.textContent = meta.hint;

      text.appendChild(title);
      text.appendChild(hint);

      item.appendChild(swatch);
      item.appendChild(text);
      dom.legendGrid.appendChild(item);
    });
  }

  function renderSummary() {
    if (!dom.summaryGrid) return;

    const counts = {
      TOTAL: state.lockers.length,
      LIBRE: 0,
      OCUPADO: 0,
      MANTENIMIENTO: 0,
      BLOQUEADO: 0
    };

    state.lockers.forEach((locker) => {
      const key = normalizeEstado(locker.estado);
      if (counts[key] !== undefined) counts[key] += 1;
    });

    dom.summaryGrid.innerHTML = "";
    const summaryItems = [
      { label: "Total", value: counts.TOTAL },
      { label: "Libres", value: counts.LIBRE },
      { label: "Ocupados", value: counts.OCUPADO },
      { label: "Mantenimiento", value: counts.MANTENIMIENTO },
      { label: "Bloqueados", value: counts.BLOQUEADO }
    ];

    summaryItems.forEach((item) => {
      const row = document.createElement("div");
      row.className = "summary-item";
      const label = document.createElement("span");
      label.textContent = item.label;
      const value = document.createElement("span");
      value.textContent = item.value;
      row.appendChild(label);
      row.appendChild(value);
      dom.summaryGrid.appendChild(row);
    });

    if (dom.totalCount) dom.totalCount.textContent = counts.TOTAL;
    if (dom.assignedCount) {
      const assigned = state.lockers.filter((locker) => locker.colaborador_nombre).length;
      dom.assignedCount.textContent = assigned;
    }
    if (dom.freeCount) dom.freeCount.textContent = counts.LIBRE;
  }

  function renderSelected() {
    const locker = getSelectedLocker();
    const hasSelection = !!locker;

    dom.selectedHint.textContent = hasSelection
      ? "Edita la ficha o cambia el estado desde la leyenda."
      : "Selecciona un locker del mapa.";

    dom.saveBtn.disabled = !hasSelection;
    dom.releaseBtn.disabled = !hasSelection;

    dom.nameInput.disabled = !hasSelection;
    dom.dniInput.disabled = !hasSelection;
    dom.dateInput.disabled = !hasSelection;
    dom.notesInput.disabled = !hasSelection;
    dom.groupSelect.disabled = !hasSelection;

    if (!hasSelection) {
      dom.selectedCode.textContent = "--";
      dom.selectedGroup.textContent = "--";
      dom.selectedState.textContent = "--";
      dom.selectedUpdated.textContent = "--";
      dom.nameInput.value = "";
      dom.dniInput.value = "";
      dom.dateInput.value = "";
      dom.notesInput.value = "";
      dom.selectedStateBadge.style.setProperty("--state-color", "#9ca3af");
    dom.selectedStateLabel.textContent = "Sin seleccion";
      return;
    }

    const meta = getStateMeta(locker.estado);
    dom.selectedCode.textContent = locker.codigo || "--";
    dom.selectedGroup.textContent = normalizeGrupo(locker.grupo);
    dom.selectedState.textContent = meta.label;
    dom.selectedUpdated.textContent = formatDate(locker.updated_at || locker.created_at);

    dom.nameInput.value = locker.colaborador_nombre || "";
    dom.dniInput.value = locker.colaborador_dni || "";
    dom.dateInput.value = locker.fecha_asignacion || "";
    dom.notesInput.value = locker.observaciones || "";

    dom.groupSelect.value = normalizeGrupo(locker.grupo);
    dom.selectedStateBadge.style.setProperty("--state-color", locker.color_estado || meta.color);
    dom.selectedStateLabel.textContent = meta.label;
  }

  function updateLegendActive() {
    if (!dom.legendGrid) return;
    const locker = getSelectedLocker();
    const activeState = locker ? normalizeEstado(locker.estado) : null;

    dom.legendGrid.querySelectorAll(".legend-item").forEach((item) => {
      const isActive = item.dataset.estado === activeState;
      item.classList.toggle("is-active", isActive);
    });
  }

  function buildGroupMap(list) {
    const map = new Map();
    list.forEach((locker) => {
      const group = normalizeGrupo(locker.grupo);
      if (!map.has(group)) map.set(group, []);
      map.get(group).push(locker);
    });
    return map;
  }

  function renderGroups() {
    if (!dom.groupsContainer) return;
    const filtered = applyFilters(state.lockers);
    dom.groupsContainer.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No hay lockers con los filtros actuales.";
      dom.groupsContainer.appendChild(empty);
      return;
    }

    const groupMap = buildGroupMap(filtered);
    const dynamicGroups = Array.from(groupMap.keys()).filter(
      (group) => !GROUP_ORDER.includes(group)
    );
    dynamicGroups.sort();
    const groups = [...GROUP_ORDER, ...dynamicGroups];

    groups.forEach((group, index) => {
      const items = groupMap.get(group) || [];
      const section = document.createElement("section");
      section.className = "locker-group";
      section.dataset.group = group;
      section.style.animationDelay = `${index * 0.05}s`;

      const header = document.createElement("div");
      header.className = "group-header";
      const title = document.createElement("h3");
      title.textContent = group;
      const count = document.createElement("span");
      count.textContent = `${items.length} lockers`;
      header.appendChild(title);
      header.appendChild(count);

      const grid = document.createElement("div");
      grid.className = "locker-grid";

      if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Sin lockers en este grupo.";
        grid.appendChild(empty);
      } else {
        items
          .slice()
          .sort((a, b) =>
            String(a.codigo || "").localeCompare(String(b.codigo || ""), "es", {
              numeric: true,
              sensitivity: "base"
            })
          )
          .forEach((locker) => grid.appendChild(renderLockerCard(locker)));
      }

      section.appendChild(header);
      section.appendChild(grid);
      dom.groupsContainer.appendChild(section);
    });
  }

  function renderLockerCard(locker) {
    const meta = getStateMeta(locker.estado);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "locker-card";
    card.dataset.id = locker.id;
    card.style.setProperty("--state-color", locker.color_estado || meta.color);
    if (locker.id === state.selectedId) card.classList.add("is-selected");

    const header = document.createElement("div");
    header.className = "locker-card-header";
    const code = document.createElement("div");
    code.className = "locker-code";
    code.textContent = locker.codigo || "--";
    const stateLabel = document.createElement("div");
    stateLabel.className = "locker-state";
    stateLabel.textContent = meta.label;
    header.appendChild(code);
    header.appendChild(stateLabel);

    const assignee = document.createElement("div");
    assignee.className = "locker-assignee";
    assignee.textContent = locker.colaborador_nombre || "Sin asignar";

    const metaLine = document.createElement("div");
    metaLine.className = "locker-meta";
    const parts = [];
    if (locker.colaborador_dni) parts.push(`DNI ${locker.colaborador_dni}`);
    if (locker.fecha_asignacion) parts.push(formatDate(locker.fecha_asignacion));
    metaLine.textContent = parts.length ? parts.join(" | ") : meta.hint;

    const iconWrap = document.createElement("div");
    iconWrap.className = "locker-icon";
    const icon = document.createElement("i");
    const iconClass = locker.icono_estado || meta.icon;
    icon.className = `fa-solid ${iconClass}`;
    icon.setAttribute("aria-hidden", "true");
    iconWrap.appendChild(icon);

    card.appendChild(header);
    card.appendChild(assignee);
    card.appendChild(metaLine);
    card.appendChild(iconWrap);

    return card;
  }

  function renderAll() {
    renderSummary();
    renderGroups();
    renderSelected();
    updateLegendActive();
  }

  async function updateLocker(id, payload, successMessage) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("Supabase no esta disponible.", "error");
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
      return null;
    }

    const index = state.lockers.findIndex((locker) => locker.id === id);
    if (index >= 0) state.lockers[index] = data;
    else state.lockers.push(data);

    ensureGroupSelectOptions(state.lockers);
    renderAll();
    setStatus(successMessage || "Locker actualizado.", "success");
    return data;
  }

  async function handleSave() {
    const locker = getSelectedLocker();
    if (!locker) {
      setStatus("Selecciona un locker para continuar.", "warn");
      return;
    }

    const name = dom.nameInput.value.trim();
    const dni = dom.dniInput.value.trim();
    const date = dom.dateInput.value || (name ? new Date().toISOString().slice(0, 10) : "");
    const notes = dom.notesInput.value.trim();
    const group = dom.groupSelect.value || normalizeGrupo(locker.grupo);

    if (!name && locker.colaborador_nombre && name !== locker.colaborador_nombre) {
      setStatus("Para liberar un locker usa el boton Liberar locker.", "warn");
      return;
    }

    const payload = {
      grupo: group,
      observaciones: notes || null,
      updated_at: new Date().toISOString()
    };

    if (name) {
      const occupiedMeta = STATE_META.OCUPADO;
      payload.colaborador_nombre = name;
      payload.colaborador_dni = dni || null;
      payload.fecha_asignacion = date || null;
      payload.estado = "OCUPADO";
      payload.color_estado = occupiedMeta.color;
      payload.icono_estado = occupiedMeta.icon;
    }

    await updateLocker(locker.id, payload, "Locker actualizado.");
  }

  async function handleRelease() {
    const locker = getSelectedLocker();
    if (!locker) {
      setStatus("Selecciona un locker para continuar.", "warn");
      return;
    }

    const libreMeta = STATE_META.LIBRE;
    const payload = {
      colaborador_nombre: null,
      colaborador_dni: null,
      fecha_asignacion: null,
      estado: "LIBRE",
      color_estado: libreMeta.color,
      icono_estado: libreMeta.icon,
      observaciones: dom.notesInput.value.trim() || null,
      grupo: dom.groupSelect.value || normalizeGrupo(locker.grupo),
      updated_at: new Date().toISOString()
    };

    await updateLocker(locker.id, payload, "Locker liberado.");
  }

  async function handleLegendChange(estado) {
    const locker = getSelectedLocker();
    if (!locker) {
      setStatus("Selecciona un locker para aplicar estado.", "warn");
      return;
    }

    const meta = STATE_META[estado] || STATE_META.LIBRE;
    const payload = {
      estado,
      color_estado: meta.color,
      icono_estado: meta.icon,
      updated_at: new Date().toISOString()
    };

    await updateLocker(locker.id, payload, "Estado actualizado.");
  }

  function handleCardClick(event) {
    const card = event.target.closest(".locker-card");
    if (!card) return;
    state.selectedId = card.dataset.id;
    renderAll();
  }

  function bindEvents() {
    dom.searchInput.addEventListener("input", (event) => {
      const value = event.target.value.trim().toLowerCase();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.search = value;
        renderGroups();
      }, 120);
    });

    dom.stateFilter.addEventListener("change", (event) => {
      state.filters.estado = event.target.value;
      renderGroups();
    });

    dom.groupFilter.addEventListener("change", (event) => {
      state.filters.grupo = event.target.value;
      renderGroups();
    });

    dom.showInactive.addEventListener("change", (event) => {
      state.filters.showInactive = event.target.checked;
      renderGroups();
    });

    dom.refreshBtn.addEventListener("click", () => loadLockers(true));
    dom.saveBtn.addEventListener("click", handleSave);
    dom.releaseBtn.addEventListener("click", handleRelease);

    dom.legendGrid.addEventListener("click", (event) => {
      const item = event.target.closest(".legend-item");
      if (!item) return;
      handleLegendChange(item.dataset.estado);
    });

    dom.groupsContainer.addEventListener("click", handleCardClick);
  }

  async function loadLockers(force = false) {
    setStatus("Cargando lockers...", "info");
    const supabase = await waitForSupabase();
    if (!supabase) {
      setStatus("Supabase no disponible. Revisa config.js.", "error");
      return;
    }

    const { data, error } = await supabase
      .from("lockers")
      .select("*")
      .order("codigo", { ascending: true });

    if (error) {
      setStatus(`Error al cargar lockers: ${error.message || error}`, "error");
      return;
    }

    state.lockers = Array.isArray(data) ? data : [];
    ensureGroupSelectOptions(state.lockers);
    renderAll();

    if (!state.channel || force) {
      subscribeToRealtime(supabase);
    }

    setStatus("Datos actualizados.", "success");
  }

  function applyRealtimePayload(payload) {
    if (!payload) return;
    const { eventType } = payload;
    const newRow = payload.new;
    const oldRow = payload.old;

    if (eventType === "INSERT" && newRow) {
      state.lockers.push(newRow);
    }
    if (eventType === "UPDATE" && newRow) {
      const index = state.lockers.findIndex((locker) => locker.id === newRow.id);
      if (index >= 0) state.lockers[index] = newRow;
      else state.lockers.push(newRow);
    }
    if (eventType === "DELETE" && oldRow) {
      state.lockers = state.lockers.filter((locker) => locker.id !== oldRow.id);
      if (state.selectedId === oldRow.id) state.selectedId = null;
    }

    ensureGroupSelectOptions(state.lockers);
    renderAll();
  }

  function subscribeToRealtime(supabase) {
    if (state.channel) {
      try {
        state.channel.unsubscribe();
      } catch (err) {
        // ignore
      }
    }

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
    if (state.channel) {
      try {
        state.channel.unsubscribe();
      } catch (err) {
        // ignore
      }
    }
    state.channel = null;
  }

  function cacheDom(root) {
    dom = {
      root,
      searchInput: root.querySelector("#lockerSearch"),
      stateFilter: root.querySelector("#lockerStateFilter"),
      groupFilter: root.querySelector("#lockerGroupFilter"),
      showInactive: root.querySelector("#lockerShowInactive"),
      refreshBtn: root.querySelector("#lockerRefresh"),
      legendGrid: root.querySelector("#legendGrid"),
      summaryGrid: root.querySelector("#summaryGrid"),
      groupsContainer: root.querySelector("#lockerGroups"),
      status: root.querySelector("#lockersStatus"),
      selectedHint: root.querySelector("#lockerSelectedHint"),
      selectedCode: root.querySelector("#lockerSelectedCode"),
      selectedGroup: root.querySelector("#lockerSelectedGroup"),
      selectedState: root.querySelector("#lockerSelectedState"),
      selectedUpdated: root.querySelector("#lockerSelectedUpdated"),
      selectedStateBadge: root.querySelector("#lockerSelectedStateBadge"),
      selectedStateLabel: root.querySelector("#lockerSelectedStateLabel"),
      nameInput: root.querySelector("#lockerName"),
      dniInput: root.querySelector("#lockerDni"),
      dateInput: root.querySelector("#lockerDate"),
      notesInput: root.querySelector("#lockerNotes"),
      groupSelect: root.querySelector("#lockerGroup"),
      saveBtn: root.querySelector("#lockerSaveBtn"),
      releaseBtn: root.querySelector("#lockerReleaseBtn"),
      totalCount: root.querySelector("#lockerTotalCount"),
      assignedCount: root.querySelector("#lockerAssignedCount"),
      freeCount: root.querySelector("#lockerFreeCount")
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

    cacheDom(root);
    renderLegend();
    renderSummary();
    renderGroups();
    renderSelected();
    bindEvents();
    loadLockers();
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("partial:loaded", init);
})();
