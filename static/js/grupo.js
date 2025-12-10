const params = new URLSearchParams(window.location.search);
let currentGroup = (params.get("g") || "A").toUpperCase();
let gruposDisponibles = [];
let partidosVigentes = [];

const title = document.getElementById("title");
const tablaContainer = document.getElementById("tabla-container");
const matchesContainer = document.getElementById("matches-container");
const matchesCard = document.querySelector(".matches-card");
const journeyNav = document.getElementById("journey-nav");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const resetBtn = document.getElementById("reset-group");
const statusEl = document.getElementById("status");
const stepper = document.getElementById("stepper");
let saveTimeout;

function renderTabla(equipos) {
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
  partidosVigentes = jornadas;
  matchesContainer.innerHTML = "";
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

  adjustMatchesHeight();
}

function renderGroup(data) {
  title.textContent = `Grupo ${data.grupo}`;
  stepper.textContent = data.grupo;
  gruposDisponibles = data.gruposDisponibles || gruposDisponibles;
  renderTabla(data.equipos);
  const partidos = data.partidos || [];
  renderMatches(partidos);
}

function adjustMatchesHeight() {
  if (!matchesCard) return;
  const rect = matchesCard.getBoundingClientRect();
  const footer = document.querySelector("footer");
  const footerSpace = (footer?.offsetHeight || 40) + 14;
  const available = window.innerHeight - rect.top - footerSpace;
  const targetHeight = Math.max(260, available);
  matchesCard.style.maxHeight = `${targetHeight}px`;
  matchesCard.style.overflowY = "auto";
}

async function loadGroup(id) {
  statusEl.textContent = "Cargando...";
  try {
    const res = await fetch(`/api/groups/${id}`);
    if (!res.ok) throw new Error("Grupo no encontrado");
    const data = await res.json();
    currentGroup = data.grupo;
    renderGroup(data);
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

function cycleGroup(direction) {
  if (!gruposDisponibles.length) return;
  const idx = gruposDisponibles.indexOf(currentGroup);
  const nextIdx = (idx + direction + gruposDisponibles.length) % gruposDisponibles.length;
  const nextGroup = gruposDisponibles[nextIdx];
  window.location.search = `?g=${encodeURIComponent(nextGroup)}`;
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
  statusEl.textContent = "Actualizando...";
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
    statusEl.textContent = "Actualizado";
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

function triggerAutoSave() {
  statusEl.textContent = "Actualizando...";
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    save();
  }, 250);
}

async function resetGroup() {
  statusEl.textContent = "Reiniciando grupo...";
  try {
    const res = await fetch(`/api/groups/${currentGroup}/reset`, { method: "POST" });
    if (!res.ok) throw new Error("No se pudo reiniciar el grupo");
    await loadGroup(currentGroup);
    statusEl.textContent = "Grupo reiniciado";
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

prevBtn?.addEventListener("click", () => cycleGroup(-1));
nextBtn?.addEventListener("click", () => cycleGroup(1));
resetBtn?.addEventListener("click", resetGroup);
matchesContainer?.addEventListener("input", (event) => {
  if (event.target && event.target.matches("input[type='number']")) {
    triggerAutoSave();
  }
});
window.addEventListener("resize", adjustMatchesHeight);

loadGroup(currentGroup);
