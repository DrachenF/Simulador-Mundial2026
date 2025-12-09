const params = new URLSearchParams(window.location.search);
let currentGroup = (params.get("g") || "A").toUpperCase();
let gruposDisponibles = [];

const title = document.getElementById("title");
const container = document.getElementById("form-container");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const saveBtn = document.getElementById("save");
const statusEl = document.getElementById("status");

function buildRow(team) {
  const row = document.createElement("div");
  row.className = "input-row";
  row.dataset.pais = team.pais;
  row.innerHTML = `
    <strong>${team.pais}</strong>
    <input type="number" name="pj" value="${team.pj}" min="0" />
    <input type="number" name="w" value="${team.w}" min="0" />
    <input type="number" name="d" value="${team.d}" min="0" />
    <input type="number" name="l" value="${team.l}" min="0" />
    <input type="number" name="GF" value="${team.GF}" min="0" />
    <input type="number" name="GC" value="${team.GC}" min="0" />
  `;
  return row;
}

function renderGroup(data) {
  title.textContent = `Grupo ${data.grupo}`;
  gruposDisponibles = data.gruposDisponibles || gruposDisponibles;
  container.innerHTML = "";
  const header = document.createElement("div");
  header.className = "input-row";
  header.innerHTML = `
    <span></span>
    <span class="subtitle">PJ</span>
    <span class="subtitle">W</span>
    <span class="subtitle">D</span>
    <span class="subtitle">L</span>
    <span class="subtitle">GF</span>
    <span class="subtitle">GC</span>
  `;
  container.appendChild(header);
  data.equipos.forEach((t) => container.appendChild(buildRow(t)));
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
  const rows = Array.from(container.querySelectorAll(".input-row"));
  return rows
    .filter((r) => r.dataset.pais)
    .map((row) => {
      const getValue = (name) => parseInt(row.querySelector(`input[name="${name}"]`).value || "0", 10);
      return {
        pais: row.dataset.pais,
        pj: getValue("pj"),
        w: getValue("w"),
        d: getValue("d"),
        l: getValue("l"),
        GF: getValue("GF"),
        GC: getValue("GC"),
      };
    });
}

async function save() {
  statusEl.textContent = "Guardando...";
  try {
    const equipos = collectData();
    const res = await fetch(`/api/groups/${currentGroup}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipos }),
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
