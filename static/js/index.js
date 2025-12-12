const phaseTabs = document.querySelectorAll("[data-phase]");
const phasePanels = document.querySelectorAll("[data-phase-panel]");
const groupTabsRow = document.getElementById("group-tabs");
const groupsContainer = document.getElementById("groups");
const refreshBtn = document.getElementById("refresh");
const statusPill = document.getElementById("status-pill");

// Detalle de grupo
const detailTitle = document.getElementById("detail-title");
const detailStepper = document.getElementById("detail-stepper");
const detailPrevBtn = document.getElementById("detail-prev");
const detailNextBtn = document.getElementById("detail-next");
const resetGroupBtn = document.getElementById("reset-group");
const tablaContainer = document.getElementById("tabla-container");
const journeyNav = document.getElementById("journey-nav");
const matchesContainer = document.getElementById("matches-container");
const groupStatus = document.getElementById("group-status");

// Eliminatoria
const bracketGrid = document.getElementById("bracket-grid");
const thirdsGrid = document.getElementById("thirds-grid");
const syncBtn = document.getElementById("sync");
const bracketStatus = document.getElementById("bracket-status");

let gruposDisponibles = [];
let currentGroup = null;
let saveTimeout;
let bracketSaveTimeout;
let bracketLoaded = false;

// Utilidades compartidas
function setPhase(phase) {
  phaseTabs.forEach((tab) => {
    const isActive = tab.dataset.phase === phase;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  phasePanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.phasePanel !== phase);
  });

  if (phase === "elimination") {
    groupTabsRow.classList.add("hidden");
    if (!bracketLoaded) {
      loadBracket();
    }
  } else {
    groupTabsRow.classList.remove("hidden");
  }
}

phaseTabs.forEach((tab) => {
  tab.addEventListener("click", () => setPhase(tab.dataset.phase));
});

function renderGroupTabs(list) {
  groupTabsRow.innerHTML = "";
  list.forEach((id) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.dataset.group = id;
    btn.role = "tab";
    btn.textContent = id;
    btn.setAttribute("aria-selected", "false");
    btn.addEventListener("click", () => activateGroup(id));
    groupTabsRow.appendChild(btn);
  });
}

function setActiveGroupTab(id) {
  Array.from(groupTabsRow.querySelectorAll(".tab")).forEach((tab) => {
    const isActive = tab.dataset.group === id;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

async function fetchGroups() {
  const res = await fetch("/api/groups");
  if (!res.ok) throw new Error("No se pudieron cargar los grupos");
  return res.json();
}

async function fetchGroupsFromCsv() {
  const opciones = ["/ResultadoGrupos.csv", "/grupos.csv"];
  let ultimoError;

  for (const url of opciones) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        ultimoError = new Error(`No se pudo leer ${url}`);
        continue;
      }
      const texto = await res.text();
      return parseCsv(texto);
    } catch (err) {
      ultimoError = err;
    }
  }

  throw ultimoError ?? new Error("No se pudieron cargar los CSV locales");
}

function parseCsv(texto) {
  const lineas = texto.trim().split(/\r?\n/);
  const encabezados = lineas.shift()?.split(",");
  if (!encabezados) throw new Error("CSV vacío");

  const grupos = {};
  lineas.forEach((linea) => {
    if (!linea.trim()) return;
    const cols = linea.split(",");
    if (cols.length < 10) return;
    const [grupo, pais, pj, w, d, l, GF, GC, DG, pts, puesto] = cols;
    const equipo = {
      grupo: grupo.trim(),
      pais: pais.trim(),
      pj: Number(pj) || 0,
      w: Number(w) || 0,
      d: Number(d) || 0,
      l: Number(l) || 0,
      GF: Number(GF) || 0,
      GC: Number(GC) || 0,
      DG: Number(DG) || 0,
      pts: Number(pts) || 0,
      puesto: Number(puesto) || 0,
    };
    grupos[equipo.grupo] = grupos[equipo.grupo] || [];
    grupos[equipo.grupo].push(equipo);
  });

  const ordenados = {};
  Object.keys(grupos)
    .sort()
    .forEach((g) => {
      ordenados[g] = ordenarGrupo(grupos[g]);
    });
  return { grupos: ordenados, gruposDisponibles: Object.keys(ordenados) };
}

function ordenarGrupo(equipos) {
  const recalculados = equipos.map((e) => ({
    ...e,
    DG: Number(e.GF || 0) - Number(e.GC || 0),
    pts: Number(e.w || 0) * 3 + Number(e.d || 0),
  }));

  const ordenados = recalculados.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.DG !== a.DG) return b.DG - a.DG;
    if (b.GF !== a.GF) return b.GF - a.GF;
    return a.pais.localeCompare(b.pais);
  });

  return ordenados.map((e, idx) => ({ ...e, puesto: idx + 1 }));
}

function renderGroupCard(groupId, teams) {
  const card = document.createElement("article");
  card.className = "card";

  const header = document.createElement("header");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.group = groupId;
  button.className = "group-link button secondary";
  button.textContent = `Grupo ${groupId}`;
  header.append(button);

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>País</th>
        <th>PJ</th>
        <th>W</th>
        <th>D</th>
        <th>L</th>
        <th>GF</th>
        <th>GC</th>
        <th>DG</th>
        <th>Pts</th>
      </tr>
    </thead>
    <tbody>
      ${teams
        .map(
          (t) => `
        <tr>
          <td>${t.puesto}. ${t.pais}</td>
          <td>${t.pj}</td>
          <td>${t.w}</td>
          <td>${t.d}</td>
          <td>${t.l}</td>
          <td>${t.GF}</td>
          <td>${t.GC}</td>
          <td>${t.DG}</td>
          <td>${t.pts}</td>
        </tr>`
        )
        .join("")}
    </tbody>`;

  card.append(header, table);
  return card;
}

function setStatus(text, tone = "neutral") {
  if (!statusPill) return;
  statusPill.textContent = text;
  statusPill.style.borderColor = tone === "error" ? "rgba(255, 99, 132, 0.4)" : "var(--border)";
  statusPill.style.background =
    tone === "error"
      ? "rgba(255, 99, 132, 0.08)"
      : "linear-gradient(135deg, rgba(95,230,201,0.08), rgba(111,163,255,0.08))";
}

async function resetData() {
  setStatus("Reiniciando con grupos.csv...", "neutral");
  try {
    const res = await fetch("/api/reset", { method: "POST" });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Error al reiniciar" }));
      throw new Error(error.error || "No se pudo reiniciar");
    }
    setStatus("Datos reiniciados", "neutral");
    await renderOverview();
    if (currentGroup) {
      await loadGroup(currentGroup);
    }
  } catch (err) {
    console.error(err);
    setStatus(err.message, "error");
  }
}

async function renderOverview() {
  groupsContainer.innerHTML = "<p class='subtitle'>Cargando grupos…</p>";
  setStatus("Sincronizando", "neutral");
  try {
    let data;
    try {
      data = await fetchGroups();
    } catch (apiError) {
      console.warn("Fallo la API, usando CSV local", apiError);
      data = await fetchGroupsFromCsv();
      setStatus("Datos desde CSV", "neutral");
    }
    groupsContainer.innerHTML = "";
    const groups = data.grupos;
    const keys = Object.keys(groups).sort();
    gruposDisponibles = data.gruposDisponibles || keys;
    renderGroupTabs(gruposDisponibles);
    if (!keys.length) {
      groupsContainer.innerHTML = "<p class='subtitle'>No hay grupos registrados. Verifica que el CSV tenga datos.</p>";
    } else {
      keys.forEach((g) => {
        groupsContainer.appendChild(renderGroupCard(g, groups[g]));
      });
    }
    const source = data.gruposDisponibles?.length ? "Datos listos" : "Sin datos";
    setStatus(source, "neutral");
  } catch (err) {
    groupsContainer.innerHTML =
      "<p class='subtitle'>No pudimos cargar los grupos. ¿Ejecutaste <code>python web_app.py</code>?" +
      " También asegúrate de tener <strong>grupos.csv</strong> o <strong>ResultadoGrupos.csv</strong> en la carpeta raíz.</p>";
    setStatus("Error de carga", "error");
  }
}

// ====================
// Detalle de grupo
// ====================
function renderTabla(equipos) {
  if (!equipos?.length) {
    tablaContainer.innerHTML = "<p class='subtitle'>Selecciona un grupo para ver su tabla.</p>";
    return;
  }
  const table = document.createElement("table");
  table.className = "table wide";
  table.innerHTML = `
    <thead>
      <tr>
        <th>País</th>
        <th>PJ</th>
        <th>W</th>
        <th>D</th>
        <th>L</th>
        <th>GF</th>
        <th>GC</th>
        <th>DG</th>
        <th>Pts</th>
      </tr>
    </thead>
    <tbody>
      ${equipos
        .map(
          (t) => `
        <tr>
          <td>${t.puesto}. ${t.pais}</td>
          <td>${t.pj}</td>
          <td>${t.w}</td>
          <td>${t.d}</td>
          <td>${t.l}</td>
          <td>${t.GF}</td>
          <td>${t.GC}</td>
          <td>${t.DG}</td>
          <td>${t.pts}</td>
        </tr>`
        )
        .join("")}
    </tbody>
  `;
  tablaContainer.innerHTML = "";
  tablaContainer.appendChild(table);
}

function renderJourneyNav(jornadas) {
  if (!journeyNav) return;
  journeyNav.innerHTML = "";
  jornadas.forEach((jornada) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pill muted";
    btn.textContent = `J${jornada.jornada}`;
    btn.addEventListener("click", () => {
      const anchor = document.getElementById(`jornada-${jornada.jornada}`);
      anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    journeyNav.appendChild(btn);
  });
}

function renderMatches(jornadas) {
  matchesContainer.innerHTML = "";
  if (!jornadas?.length) {
    matchesContainer.innerHTML = "<p class='subtitle'>Selecciona un grupo para editar sus partidos.</p>";
    return;
  }
  renderJourneyNav(jornadas);

  jornadas.forEach((jornada) => {
    const titulo = document.createElement("h3");
    titulo.className = "journey-title";
    titulo.id = `jornada-${jornada.jornada}`;
    titulo.textContent = `Jornada ${jornada.jornada}`;
    matchesContainer.appendChild(titulo);

    jornada.partidos.forEach((partido) => {
      const local = partido.equipo1;
      const visita = partido.equipo2;
      const goles1 = partido.goles1;
      const goles2 = partido.goles2;
      const row = document.createElement("div");
      row.className = "match-row";
      row.dataset.local = local;
      row.dataset.visita = visita;
      row.dataset.jornada = jornada.jornada;
      row.innerHTML = `
        <span class="team">${local}</span>
        <input type="number" name="goles1" min="0" value="${
          goles1 === undefined || goles1 === null ? "" : goles1
        }" aria-label="Goles de ${local}" />
        <input type="number" name="goles2" min="0" value="${
          goles2 === undefined || goles2 === null ? "" : goles2
        }" aria-label="Goles de ${visita}" />
        <span class="team">${visita}</span>
      `;
      matchesContainer.appendChild(row);
    });
  });
}

function renderGroup(data) {
  detailTitle.textContent = data?.grupo ? `Grupo ${data.grupo}` : "Selecciona un grupo para editar";
  detailStepper.textContent = data?.grupo ?? "—";
  gruposDisponibles = data?.gruposDisponibles || gruposDisponibles;
  renderTabla(data?.equipos);
  renderMatches(data?.partidos || []);
}

async function loadGroup(id) {
  groupStatus.textContent = "Cargando...";
  try {
    const res = await fetch(`/api/groups/${id}`);
    if (!res.ok) throw new Error("Grupo no encontrado");
    const data = await res.json();
    currentGroup = data.grupo;
    setActiveGroupTab(currentGroup);
    renderGroup(data);
    groupStatus.textContent = "";
  } catch (err) {
    groupStatus.textContent = err.message;
  }
}

function activateGroup(id) {
  setPhase("groups");
  setActiveGroupTab(id);
  loadGroup(id);
}

function cycleGroup(direction) {
  if (!gruposDisponibles.length || !currentGroup) return;
  const idx = gruposDisponibles.indexOf(currentGroup);
  const nextIdx = (idx + direction + gruposDisponibles.length) % gruposDisponibles.length;
  const nextGroup = gruposDisponibles[nextIdx];
  activateGroup(nextGroup);
}

function collectData() {
  const rows = Array.from(matchesContainer.querySelectorAll(".match-row"));
  return rows.map((row) => {
    const val1 = row.querySelector('input[name="goles1"]').value;
    const val2 = row.querySelector('input[name="goles2"]').value;

    const parsed1 = val1.trim() === "" ? null : Number.parseInt(val1, 10);
    const parsed2 = val2.trim() === "" ? null : Number.parseInt(val2, 10);
    const goles1 = Number.isNaN(parsed1) ? null : parsed1;
    const goles2 = Number.isNaN(parsed2) ? null : parsed2;
    return {
      equipo1: row.dataset.local,
      equipo2: row.dataset.visita,
      goles1,
      goles2,
      jornada: Number(row.dataset.jornada || 0),
    };
  });
}

async function save() {
  if (!currentGroup) return;
  groupStatus.textContent = "Actualizando...";
  try {
    const partidos = collectData();
    const res = await fetch(`/api/groups/${currentGroup}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partidos }),
    });
    if (!res.ok) throw new Error("No se pudo guardar");
    const data = await res.json();
    if (data?.equipos) {
      renderTabla(data.equipos);
    }
    groupStatus.textContent = "Actualizado";
  } catch (err) {
    groupStatus.textContent = err.message;
  }
}

function triggerAutoSave() {
  groupStatus.textContent = "Actualizando...";
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    save();
  }, 250);
}

async function resetGroup() {
  if (!currentGroup) return;
  groupStatus.textContent = "Reiniciando grupo...";
  try {
    const res = await fetch(`/api/groups/${currentGroup}/reset`, { method: "POST" });
    if (!res.ok) throw new Error("No se pudo reiniciar el grupo");
    await loadGroup(currentGroup);
    groupStatus.textContent = "Grupo reiniciado";
  } catch (err) {
    groupStatus.textContent = err.message;
  }
}

// ====================
// Eliminatoria
// ====================
function shortName(name) {
  if (!name) return "";
  return name.length > 18 ? `${name.slice(0, 16)}…` : name;
}

function matchCard(match, roundLabel) {
  const card = document.createElement("div");
  card.className = "match-node";
  card.dataset.id = match.id;
  const needsPens = match.goles1 !== null && match.goles2 !== null && match.goles1 === match.goles2;

  const makeInput = (value, cls, name) => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = value ?? "";
    input.name = name;
    input.className = cls;
    input.addEventListener("input", () => scheduleBracketSave(match.id));
    return input;
  };

  const row = (team, gKey, pKey) => {
    const wrap = document.createElement("div");
    wrap.className = "match-row";
    const chip = document.createElement("span");
    chip.className = "team-chip";
    chip.textContent = team ? team.slice(0, 1).toUpperCase() : "";

    const name = document.createElement("span");
    name.className = "team-name";
    name.textContent = team || "";

    const goals = makeInput(match[gKey], "score-input", gKey);
    goals.placeholder = "";

    const penBox = document.createElement("div");
    penBox.className = `pen-box ${needsPens || match[pKey] !== null ? "" : "hidden"}`;
    const pen = makeInput(match[pKey], "score-input pen", pKey);
    pen.placeholder = "p";
    penBox.append("P", pen);

    wrap.append(chip, name, goals, penBox);
    return wrap;
  };

  const header = document.createElement("div");
  header.className = "bracket-header";
  header.textContent = `${roundLabel} · Llave ${match.id}`;

  const rows = document.createElement("div");
  rows.className = "match-rows";
  rows.append(row(match.equipo1, "goles1", "pen1"), row(match.equipo2, "goles2", "pen2"));

  const winner = document.createElement("div");
  winner.className = "winner";
  winner.textContent = match.ganador ? `→ ${shortName(match.ganador)}` : "";

  card.append(header, rows, winner);
  return card;
}

function renderThirds(list) {
  thirdsGrid.innerHTML = "";
  if (!list?.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No se pudo calcular la lista de terceros.";
    thirdsGrid.appendChild(empty);
    return;
  }

  list.forEach((item, index) => {
    const chip = document.createElement("div");
    chip.className = "third-chip";
    chip.innerHTML = `<span class="rank">${index + 1}</span><span class="name">${item.pais}</span><span class="meta">${item.grupo} · ${item.pts} pts · DG ${item.DG} · GF ${item.GF}</span>`;
    thirdsGrid.appendChild(chip);
  });
}

function renderBracket(bracket) {
  if (!bracket) return;
  renderThirds(bracket.bestThirds);
  bracketGrid.innerHTML = "";
  if (!bracket.rounds?.length) return;

  bracket.rounds.forEach((round) => {
    const section = document.createElement("section");
    section.className = "round-block";

    const title = document.createElement("h3");
    title.className = "round-title";
    title.textContent = round.label;
    section.appendChild(title);

    const matchesWrap = document.createElement("div");
    matchesWrap.className = "round-matches";
    round.matches.forEach((match) => matchesWrap.appendChild(matchCard(match, round.label)));
    section.appendChild(matchesWrap);

    bracketGrid.appendChild(section);
  });
}

async function loadBracket() {
  bracketStatus.textContent = "Cargando...";
  try {
    const res = await fetch("/api/bracket");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Error al cargar llaves");
    renderBracket(data);
    bracketStatus.textContent = "Listo";
    bracketLoaded = true;
  } catch (err) {
    bracketStatus.textContent = err.message;
  }
}

async function saveMatch(matchId) {
  const card = bracketGrid.querySelector(`.match-node[data-id="${matchId}"]`);
  if (!card) return;
  const payload = { matchId };
  card.querySelectorAll("input").forEach((input) => {
    const value = input.value.trim();
    payload[input.name] = value === "" ? null : Number.parseInt(value, 10);
  });

  bracketStatus.textContent = "Actualizando...";
  const res = await fetch("/api/bracket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    bracketStatus.textContent = data?.error || "No se pudo guardar";
    return;
  }
  renderBracket(data);
  bracketStatus.textContent = "Actualizado";
}

function scheduleBracketSave(matchId) {
  if (bracketSaveTimeout) clearTimeout(bracketSaveTimeout);
  bracketSaveTimeout = setTimeout(() => saveMatch(matchId), 200);
}

// ====================
// Eventos
// ====================
refreshBtn?.addEventListener("click", resetData);
groupsContainer?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-group]");
  if (button) {
    activateGroup(button.dataset.group);
  }
});
matchesContainer?.addEventListener("input", (event) => {
  if (event.target && event.target.matches("input[type='number']")) {
    triggerAutoSave();
  }
});
syncBtn?.addEventListener("click", () => loadBracket());
bracketGrid?.addEventListener("input", (event) => {
  const card = event.target.closest(".match-node");
  if (!card) return;
  const matchId = Number(card.dataset.id);
  scheduleBracketSave(matchId);
});
detailPrevBtn?.addEventListener("click", () => cycleGroup(-1));
detailNextBtn?.addEventListener("click", () => cycleGroup(1));
resetGroupBtn?.addEventListener("click", resetGroup);

renderOverview();
