const phaseTabs = document.querySelectorAll("[data-phase]");
const phasePanels = document.querySelectorAll("[data-phase-panel]");
const groupTabsRow = document.getElementById("group-tabs");
const allGroupsTab = document.getElementById("all-groups-tab");
const groupTabsWrapper = document.getElementById("group-tabs-wrapper");
const groupsContainer = document.getElementById("groups");
const groupHeading = document.getElementById("groupHeading");
const groupBody = document.getElementById("groupBody");
const groupContent = document.getElementById("groupContent");
const refreshBtn = document.getElementById("refresh");
const statusPill = document.getElementById("status-pill");
const allTablesGrid = document.getElementById("allTablesGrid");
const bestThirdsBody = document.getElementById("bestThirdsBody");

// Detalle de grupo
const detailTitle = document.getElementById("detail-title");
const detailStepper = document.getElementById("detail-stepper");
const detailPrevBtn = document.getElementById("detail-prev");
const detailNextBtn = document.getElementById("detail-next");
const resetGroupBtn = document.getElementById("reset-group");
const tablaContainer = document.getElementById("tabla-container");
const matchesContainer = document.getElementById("matches-container");
const groupStatus = document.getElementById("group-status");
const groupDetailSection = document.getElementById("group-detail");

// Eliminatoria
const bracketGrid = document.getElementById("bracket-grid");
const thirdsGrid = document.getElementById("thirds-grid");
const bracketStatus = document.getElementById("bracket-status") || document.getElementById("status");
const bracketSyncBtn = document.getElementById("sync") || document.getElementById("sync-bracket");

let gruposDisponibles = [];
let currentGroup = null;
let saveTimeout;
let bracketSaveTimeout;
let bracketLoaded = false;
let gruposCache = null;

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

  document.body.classList.toggle("phase-elimination", phase === "elimination");

  if (phase === "elimination") {
    groupTabsWrapper?.classList.add("hidden");
    if (!bracketLoaded) {
      loadBracket();
    } else {
      fitBracket();
    }
    requestAnimationFrame(updateEliminationTopUi);
  } else {
    groupTabsWrapper?.classList.remove("hidden");
    if (phase === "tables") {
      renderTablesPanel();
    }
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

function setGroupView(target) {
  const showAll = !target || target === "all";
  groupsContainer?.classList.toggle("hidden", !showAll);
  groupDetailSection?.classList.toggle("hidden", showAll);

  if (allGroupsTab) {
    allGroupsTab.classList.toggle("active", showAll);
    allGroupsTab.setAttribute("aria-selected", String(showAll));
  }

  setActiveGroupTab(showAll ? null : target);
  if (showAll) {
    currentGroup = null;
  }
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
    await refreshBracket();
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
    gruposCache = groups;
    gruposDisponibles = data.gruposDisponibles || keys;
    renderGroupTabs(gruposDisponibles);
    setGroupView("all");
    if (!keys.length) {
      groupsContainer.innerHTML = "<p class='subtitle'>No hay grupos registrados. Verifica que el CSV tenga datos.</p>";
    } else {
      keys.forEach((g) => {
        groupsContainer.appendChild(renderGroupCard(g, groups[g]));
      });
    }
    const source = data.gruposDisponibles?.length ? "Datos listos" : "Sin datos";
    setStatus(source, "neutral");
    if (keys.length && groupBody && !groupBody.children.length) {
      const first = keys[0];
      renderGroupTablePreview(groups[first], first);
    }
    renderTablesPanel();
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

function renderGroupTablePreview(equipos, groupId) {
  if (!groupBody) return;
  if (!equipos?.length) {
    groupHeading.textContent = "Grupo";
    groupBody.innerHTML = "<tr><td colspan='9' class='subtitle'>Selecciona un grupo</td></tr>";
    return;
  }
  if (groupHeading) groupHeading.textContent = `Grupo ${groupId ?? ""}`.trim();
  groupBody.innerHTML = equipos
    .map(
      (r) => `
        <tr>
          <td class="team">${r.pais}</td>
          <td class="num">${r.pj}</td>
          <td class="num">${r.w}</td>
          <td class="num">${r.d}</td>
          <td class="num">${r.l}</td>
          <td class="num">${r.GF}</td>
          <td class="num">${r.GC}</td>
          <td class="num">${r.DG}</td>
          <td class="num">${r.pts}</td>
        </tr>`
    )
    .join("");
}

function renderFixturesPreview(partidos) {
  if (!groupContent) return;
  if (!partidos?.length) {
    groupContent.innerHTML = "<p class='subtitle'>Carga un grupo para ver sus jornadas.</p>";
    return;
  }
  const jornadas = partidos
    .map((jornada) => {
      const filas = jornada.partidos
        .map((p) => {
          const left = `<div class="teamName">${p.equipo1}</div>`;
          const right = `<div class="teamName right">${p.equipo2}</div>`;
          const marcador = `
            <div class="score" aria-hidden="true">
              <span class="box">${p.goles1 ?? ""}</span>
              <span class="dash">–</span>
              <span class="box">${p.goles2 ?? ""}</span>
            </div>`;
          return `<div class="fixtureRow">${left}${marcador}${right}</div>`;
        })
        .join("");
      return `
        <div class="mdTitle">Jornada ${jornada.jornada}</div>
        <div class="fixtures">${filas}</div>
      `;
    })
    .join('<div style="height:12px"></div>');
  groupContent.innerHTML = jornadas;
}

function renderTablesPanel() {
  if (!allTablesGrid || !bestThirdsBody) return;
  allTablesGrid.innerHTML = "";
  bestThirdsBody.innerHTML = "";
  if (!gruposCache) return;

  const letters = Object.keys(gruposCache).sort();
  letters.forEach((g) => {
    const equipos = ordenarGrupo(gruposCache[g] || []);
    const card = document.createElement("div");
    card.className = "card mini";
    card.innerHTML = `
      <div class="titleRow">
        <h3 class="sectionTitle">Grupo ${g}</h3>
        <p class="subtitle">Tabla completa</p>
      </div>
      <div class="tableWrap">
        <div class="scrollX">
          <table>
            <thead>
              <tr>
                <th>País</th>
                <th class="num">PJ</th>
                <th class="num">G</th>
                <th class="num">E</th>
                <th class="num">P</th>
                <th class="num">GF</th>
                <th class="num">GC</th>
                <th class="num">DG</th>
                <th class="num">PTS</th>
              </tr>
            </thead>
            <tbody>
              ${equipos
                .map(
                  (r) => `
                    <tr>
                      <td class="team">${r.pais}</td>
                      <td class="num">${r.pj}</td>
                      <td class="num">${r.w}</td>
                      <td class="num">${r.d}</td>
                      <td class="num">${r.l}</td>
                      <td class="num">${r.GF}</td>
                      <td class="num">${r.GC}</td>
                      <td class="num">${r.DG}</td>
                      <td class="num">${r.pts}</td>
                    </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
    allTablesGrid.appendChild(card);
  });

  const thirds = letters
    .map((g) => {
      const ordered = ordenarGrupo(gruposCache[g] || []);
      const third = ordered[2];
      return third ? { group: g, ...third } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.DG !== a.DG) return b.DG - a.DG;
      if (b.GF !== a.GF) return b.GF - a.GF;
      return a.group.localeCompare(b.group);
    });

  const top8 = thirds.slice(0, 8);
  bestThirdsBody.innerHTML = top8
    .map(
      (r, idx) => `
        <tr>
          <td class="num">${idx + 1}</td>
          <td class="team">${r.group}</td>
          <td class="team">${r.pais}</td>
          <td class="num">${r.pj}</td>
          <td class="num">${r.w}</td>
          <td class="num">${r.d}</td>
          <td class="num">${r.l}</td>
          <td class="num">${r.GF}</td>
          <td class="num">${r.GC}</td>
          <td class="num">${r.DG}</td>
          <td class="num">${r.pts}</td>
        </tr>`
    )
    .join("");
}

function renderMatches(jornadas) {
  matchesContainer.innerHTML = "";
  if (!jornadas?.length) {
    matchesContainer.innerHTML = "<p class='subtitle'>Selecciona un grupo para editar sus partidos.</p>";
    return;
  }

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
  renderGroupTablePreview(data?.equipos, data?.grupo);
  renderFixturesPreview(data?.partidos || []);
  if (gruposCache && data?.grupo && data.equipos) {
    gruposCache[data.grupo] = data.equipos;
  }
}

function updateGroupCard(groupId, equipos) {
  if (!groupId || !equipos || !groupsContainer) return;
  const card = groupsContainer.querySelector(
    `article.card button[data-group="${groupId}"]`
  )?.closest("article.card");
  if (!card) return;
  const newCard = renderGroupCard(groupId, equipos);
  card.replaceWith(newCard);
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
  setGroupView(id);
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
      updateGroupCard(currentGroup, data.equipos);
      if (gruposCache && currentGroup) {
        gruposCache[currentGroup] = data.equipos;
        renderTablesPanel();
      }
    }
    groupStatus.textContent = "Actualizado";
    await refreshBracket();
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
    await refreshBracket();
  } catch (err) {
    groupStatus.textContent = err.message;
  }
}

// ====================
// Eliminatoria
// ====================

const MATCH_HEIGHT = 70;
const MATCH_GAP = 18;

// Orden fijo de los dieciseisavos para respetar la disposición
// 1E-3ro, 1I-3ro, 2A-2B, 1F-2C, 2K-2L, 1H-2J, 1D-3ro, 1G-3ro en el lado izquierdo
// y 1C-2F, 2E-2I, 1A-3ro, 1L-3ro, 1J-2H, 2D-2G, 1B-3ro, 1K-3ro en el derecho.
const LEFT_LAYOUT = {
  R32: [1, 2, 3, 4, 5, 6, 7, 8],
  R16: [17, 18, 19, 20],
  QF: [25, 26],
  SF: [29],
};

const RIGHT_LAYOUT = {
  R32: [9, 10, 11, 12, 13, 14, 15, 16],
  R16: [21, 22, 23, 24],
  QF: [27, 28],
  SF: [30],
};

const ROUND_TITLES = {
  R32: "Dieciseisavos",
  R16: "Octavos",
  QF: "Cuartos",
  SF: "Semifinal",
};

function nextForMatch(id) {
  if (id <= 16) return 17 + Math.floor((id - 1) / 2);
  if (id <= 24) return 25 + Math.floor((id - 17) / 2);
  if (id <= 28) return 29 + Math.floor((id - 25) / 2);
  if (id <= 30) return 31;
  return "";
}

function makeInput(value, name, extraClass = "") {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.step = "1";
  input.name = name;
  input.className = `score-input ${extraClass}`.trim();
  input.value = value ?? "";
  input.placeholder = "";
  input.inputMode = "numeric";
  return input;
}

function makeTeamRow(match, nameKey, seedKey, goalsKey, penKey) {
  const row = document.createElement("div");
  row.className = "team-row";

  const info = document.createElement("div");
  info.className = "team-info";

  const seed = document.createElement("span");
  seed.className = "seed-chip";
  seed.textContent = match[seedKey] || "—";

  const label = document.createElement("span");
  label.className = "team-label";
  label.textContent = match[nameKey] || match[seedKey] || "";

  info.append(seed, label);

  const needsPens = match.goles1 !== null && match.goles2 !== null && match.goles1 === match.goles2;
  const scorebox = document.createElement("div");
  scorebox.className = "scorebox";

  const goals = makeInput(match[goalsKey], goalsKey);
  const penWrap = document.createElement("div");
  penWrap.className = `pen-box ${needsPens || match[penKey] !== null ? "" : "hidden"}`;
  penWrap.append("P", makeInput(match[penKey], penKey, "pen"));

  scorebox.append(goals, penWrap);
  row.append(info, scorebox);
  return row;
}

function buildMatchCard(match) {
  const node = document.createElement("div");
  node.className = "bracket-match";
  node.dataset.id = match.id;
  const next = nextForMatch(match.id);
  if (next) node.dataset.next = String(next);

  node.append(
    makeTeamRow(match, "equipo1", "semilla1", "goles1", "pen1"),
    makeTeamRow(match, "equipo2", "semilla2", "goles2", "pen2"),
  );

  return node;
}

function buildRoundColumn(roundKey, ids, matchLookup) {
  const col = document.createElement("div");
  col.className = "round-col";
  col.dataset.round = roundKey;

  const label = document.createElement("div");
  label.className = "rt";
  label.textContent = ROUND_TITLES[roundKey] || roundKey;
  col.appendChild(label);

  ids.forEach((id) => {
    const data = matchLookup.get(id) || { id, semilla1: "", semilla2: "" };
    col.appendChild(buildMatchCard(data));
  });

  return col;
}

function buildSide(sideEl, layout, matchLookup) {
  sideEl.innerHTML = "";
  Object.entries(layout).forEach(([key, ids]) => {
    sideEl.appendChild(buildRoundColumn(key, ids, matchLookup));
  });
}

function buildCenter(matchLookup) {
  const center = document.getElementById("center-block");
  if (!center) return;
  center.innerHTML = "";

  const block = document.createElement("div");
  block.className = "block";

  const finalLabel = document.createElement("div");
  finalLabel.className = "rt";
  finalLabel.textContent = "Final";
  finalLabel.style.top = "-26px";

  const thirdLabel = document.createElement("div");
  thirdLabel.className = "rt";
  thirdLabel.textContent = "Tercer lugar";

  const finalMatch = buildMatchCard(matchLookup.get(31) || { id: 31, semilla1: "", semilla2: "" });
  finalMatch.style.position = "absolute";
  finalMatch.style.left = "0px";

  const thirdMatch = buildMatchCard(matchLookup.get(32) || { id: 32, semilla1: "", semilla2: "" });
  thirdMatch.style.position = "absolute";
  thirdMatch.style.left = "0px";

  block.append(finalLabel, finalMatch, thirdLabel, thirdMatch);
  center.appendChild(block);
}

function layoutColumn(roundEl) {
  const matches = Array.from(roundEl.querySelectorAll(".bracket-match"));
  matches.forEach((m, i) => {
    const top = i * (MATCH_HEIGHT + MATCH_GAP);
    m.style.top = `${top}px`;
    m.dataset.centerY = (top + MATCH_HEIGHT / 2).toString();
  });
  const minH = matches.length * MATCH_HEIGHT + (matches.length - 1) * MATCH_GAP + 26;
  roundEl.style.minHeight = `${Math.max(640, minH)}px`;
  return matches;
}

function layoutNextRound(roundEl, prevMatches) {
  const matches = Array.from(roundEl.querySelectorAll(".bracket-match"));
  matches.forEach((m, i) => {
    const c1 = prevMatches[i * 2];
    const c2 = prevMatches[i * 2 + 1];
    const y1 = Number(c1?.dataset.centerY ?? 0);
    const y2 = Number(c2?.dataset.centerY ?? 0);
    const centerY = (y1 + y2) / 2;
    m.style.top = `${centerY - MATCH_HEIGHT / 2}px`;
    m.dataset.centerY = centerY.toString();
  });
  return matches;
}

function placeCenterMatches() {
  const bracket = document.getElementById("bracket-grid");
  if (!bracket) return;

  const rect = bracket.getBoundingClientRect();
  const lsf = bracket.querySelector('.bracket-match[data-id="29"]')?.getBoundingClientRect();
  const rsf = bracket.querySelector('.bracket-match[data-id="30"]')?.getBoundingClientRect();
  const final = bracket.querySelector('.bracket-match[data-id="31"]');
  const third = bracket.querySelector('.bracket-match[data-id="32"]');
  const labels = bracket.querySelectorAll("#center-block .rt");
  const finalLabel = labels[0];
  const thirdLabel = labels[1];

  if (lsf && rsf && final) {
    const y = (lsf.top + lsf.height / 2 + (rsf.top + rsf.height / 2) - 2 * rect.top) / 2;
    final.style.top = `${y - MATCH_HEIGHT / 2}px`;
    if (finalLabel) finalLabel.style.top = "-26px";

    const offset = 140;
    if (third) {
      const thirdTop = y + offset - MATCH_HEIGHT / 2;
      third.style.top = `${thirdTop}px`;
      if (thirdLabel) thirdLabel.style.top = `${thirdTop - 26}px`;
    }
  }
}

function drawConnectors() {
  const svg = document.getElementById("bracket-lines");
  const bracket = document.getElementById("bracket-grid");
  if (!svg || !bracket) return;
  const rect = bracket.getBoundingClientRect();

  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.innerHTML = "";

  const addPath = (x1, y1, x2, y2) => {
    const midX = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", getComputedStyle(document.documentElement).getPropertyValue("--border") || "rgba(255,255,255,.25)");
    p.setAttribute("stroke-width", "2");
    p.setAttribute("stroke-linecap", "round");
    svg.appendChild(p);
  };

  const matches = Array.from(document.querySelectorAll(".bracket-match[data-next]") || []);
  matches.forEach((m) => {
    const nextId = m.dataset.next;
    if (!nextId) return;
    const n = document.querySelector(`.bracket-match[data-id="${nextId}"]`);
    if (!n) return;

    const a = m.getBoundingClientRect();
    const b = n.getBoundingClientRect();

    const mCenterY = a.top - rect.top + a.height / 2;
    const nCenterY = b.top - rect.top + b.height / 2;

    const mCenterX = a.left - rect.left + a.width / 2;
    const nCenterX = b.left - rect.left + b.width / 2;

    const fromX = nCenterX > mCenterX ? a.right - rect.left : a.left - rect.left;
    const toX = nCenterX > mCenterX ? b.left - rect.left : b.right - rect.left;

    addPath(fromX, mCenterY, toX, nCenterY);
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function updateEliminationTopUi() {
  const root = document.documentElement;
  const isElim = document.body.classList.contains("phase-elimination");
  if (!isElim) return;

  const pageHeader = document.querySelector("header");
  const elimPanel = document.querySelector('[data-phase-panel="elimination"]');
  if (!elimPanel) return;

  const elimHeader = elimPanel.querySelector(".elim-header");
  const thirdsCard = elimPanel.querySelector(".thirds-card");
  const footer = document.querySelector("#global-footer");

  const h =
    (pageHeader?.offsetHeight || 0) +
    (elimHeader?.offsetHeight || 0) +
    (thirdsCard?.offsetHeight || 0) +
    (footer?.offsetHeight || 0) +
    24;

  root.style.setProperty("--top-ui", `${Math.max(180, Math.ceil(h))}px`);
}

function fitBracket() {
  const viewport = document.getElementById("bracket-viewport");
  const bracket = document.getElementById("bracket-grid");
  const elimPanel = document.querySelector('[data-phase-panel="elimination"]');

  if (!viewport || !bracket || !elimPanel || elimPanel.classList.contains("hidden")) return;

  updateEliminationTopUi();

  const prevScale = bracket.style.getPropertyValue("--bracket-scale") || "1";
  const prevX = bracket.style.getPropertyValue("--bracket-x") || "0px";
  const prevY = bracket.style.getPropertyValue("--bracket-y") || "0px";

  bracket.style.setProperty("--bracket-scale", "1");
  bracket.style.setProperty("--bracket-x", "0px");
  bracket.style.setProperty("--bracket-y", "0px");

  const naturalWidth = bracket.scrollWidth;
  const naturalHeight = bracket.scrollHeight;

  const availableWidth = viewport.clientWidth;
  const availableHeight = viewport.clientHeight;

  let scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1);
  scale = clamp(scale, 0.35, 1);

  const offsetX = (availableWidth - naturalWidth * scale) / 2;
  const offsetY = Math.max((availableHeight - naturalHeight * scale) / 2, 0);

  bracket.style.setProperty("--bracket-scale", scale);
  bracket.style.setProperty("--bracket-x", `${offsetX}px`);
  bracket.style.setProperty("--bracket-y", `${offsetY}px`);

  if (Number.isNaN(naturalWidth) || Number.isNaN(naturalHeight)) {
    bracket.style.setProperty("--bracket-scale", prevScale);
    bracket.style.setProperty("--bracket-x", prevX);
    bracket.style.setProperty("--bracket-y", prevY);
  }

  requestAnimationFrame(drawConnectors);
}

function renderThirds(list) {
  thirdsGrid.innerHTML = "";
  if (!list?.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No se pudo calcular la lista de terceros.";
    thirdsGrid.appendChild(empty);
    requestAnimationFrame(updateEliminationTopUi);
    return;
  }

  list.forEach((item, index) => {
    const chip = document.createElement("div");
    chip.className = "third-chip";
    chip.innerHTML = `<span class="rank">${index + 1}</span><span class="name">${item.pais}</span><span class="meta">${item.grupo} · ${item.pts} pts · DG ${item.DG} · GF ${item.GF}</span>`;
    thirdsGrid.appendChild(chip);
  });

  requestAnimationFrame(updateEliminationTopUi);
}

function renderBracket(bracket) {
  if (!bracket) return;
  renderThirds(bracket.bestThirds);
  if (!bracket.rounds?.length || !bracketGrid) return;

  const matchLookup = new Map();
  bracket.rounds.forEach((round) => {
    round.matches.forEach((m) => matchLookup.set(m.id, m));
  });

  bracketGrid.innerHTML = `
    <svg class="bracket-lines" id="bracket-lines" aria-hidden="true"></svg>
    <div class="side" id="left-side"></div>
    <div class="center" id="center-block"></div>
    <div class="side mirror" id="right-side"></div>
  `;

  const leftSide = document.getElementById("left-side");
  const rightSide = document.getElementById("right-side");

  if (leftSide && rightSide) {
    buildSide(leftSide, LEFT_LAYOUT, matchLookup);
    buildSide(rightSide, RIGHT_LAYOUT, matchLookup);
    buildCenter(matchLookup);

    const layoutSide = (sideEl) => {
      const cols = Array.from(sideEl.querySelectorAll(".round-col"));
      if (!cols.length) return;
      let prev = layoutColumn(cols[0]);
      for (let i = 1; i < cols.length; i += 1) {
        prev = layoutNextRound(cols[i], prev);
      }
    };

    layoutSide(leftSide);
    layoutSide(rightSide);
    placeCenterMatches();
    fitBracket();
    requestAnimationFrame(updateEliminationTopUi);
  }
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
    fitBracket();
  } catch (err) {
    bracketStatus.textContent = err.message;
  }
}

async function refreshBracket() {
  await loadBracket();
}

async function saveMatch(matchId) {
  const card = bracketGrid.querySelector(`.bracket-match[data-id="${matchId}"]`);
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
bracketSyncBtn?.addEventListener("click", refreshBracket);
groupsContainer?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-group]");
  if (button) {
    activateGroup(button.dataset.group);
  }
});
allGroupsTab?.addEventListener("click", () => {
  setPhase("groups");
  setGroupView("all");
});
matchesContainer?.addEventListener("input", (event) => {
  if (event.target && event.target.matches("input[type='number']")) {
    triggerAutoSave();
  }
});
bracketGrid?.addEventListener("input", (event) => {
  const card = event.target.closest(".bracket-match");
  if (!card) return;
  const matchId = Number(card.dataset.id);
  scheduleBracketSave(matchId);
});
window.addEventListener("resize", () => {
  if (bracketLoaded) {
    fitBracket();
    requestAnimationFrame(updateEliminationTopUi);
  }
});
window.addEventListener("orientationchange", () => {
  if (bracketLoaded) {
    setTimeout(() => {
      fitBracket();
      requestAnimationFrame(updateEliminationTopUi);
    }, 150);
  }
});
detailPrevBtn?.addEventListener("click", () => cycleGroup(-1));
detailNextBtn?.addEventListener("click", () => cycleGroup(1));
resetGroupBtn?.addEventListener("click", resetGroup);

requestAnimationFrame(updateEliminationTopUi);
renderOverview();
