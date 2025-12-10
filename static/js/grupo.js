const params = new URLSearchParams(window.location.search);
let currentGroup = (params.get("g") || "A").toUpperCase();
let gruposDisponibles = [];
let partidosVigentes = [];

const title = document.getElementById("title");
const tablaContainer = document.getElementById("tabla-container");
const matchesContainer = document.getElementById("matches-container");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");
const stepper = document.getElementById("stepper");

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

function renderMatches(jornadas) {
  partidosVigentes = jornadas;
  matchesContainer.innerHTML = "";

  jornadas.forEach((jornada) => {
    const titulo = document.createElement("h3");
    titulo.className = "journey-title";
    titulo.textContent = `Jornada ${jornada.jornada}`;
    matchesContainer.appendChild(titulo);

    jornada.partidos.forEach(([local, visita]) => {
      const row = document.createElement("div");
      row.className = "match-row";
      row.dataset.local = local;
      row.dataset.visita = visita;
      row.dataset.jornada = jornada.jornada;
      row.innerHTML = `
        <span class="team">${local}</span>
        <input type="number" name="goles1" min="0" value="0" aria-label="Goles de ${local}" />
        <input type="number" name="goles2" min="0" value="0" aria-label="Goles de ${visita}" />
        <span class="team">${visita}</span>
      `;
      matchesContainer.appendChild(row);
    });
  });
}

function renderGroup(data) {
  title.textContent = `Grupo ${data.grupo}`;
  stepper.textContent = data.grupo;
  gruposDisponibles = data.gruposDisponibles || gruposDisponibles;
  renderTabla(data.equipos);
  const partidos = data.partidos || [];
  renderMatches(partidos);
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
    const goles1 = parseInt(row.querySelector('input[name="goles1"]').value || "0", 10);
    const goles2 = parseInt(row.querySelector('input[name="goles2"]').value || "0", 10);
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
  statusEl.textContent = "Guardando...";
  try {
    const partidos = collectData();
    const res = await fetch(`/api/groups/${currentGroup}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partidos }),
    });
    if (!res.ok) throw new Error("No se pudo guardar");
    await res.json();
    statusEl.textContent = "Actualizado";
    loadGroup(currentGroup);
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

prevBtn?.addEventListener("click", () => cycleGroup(-1));
nextBtn?.addEventListener("click", () => cycleGroup(1));
saveBtn?.addEventListener("click", save);

loadGroup(currentGroup);
