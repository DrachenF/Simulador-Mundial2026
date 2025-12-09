const groupsContainer = document.getElementById("groups");
const refreshBtn = document.getElementById("refresh");
const statusPill = document.getElementById("status-pill");

async function fetchGroups() {
  const res = await fetch("/api/groups");
  if (!res.ok) throw new Error("No se pudieron cargar los grupos");
  return res.json();
}

function renderGroupCard(groupId, teams) {
  const card = document.createElement("article");
  card.className = "card";

  const header = document.createElement("header");
  const h2 = document.createElement("h2");
  h2.textContent = `Grupo ${groupId}`;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `${teams.length} equipos`;
  header.append(h2, badge);

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>País</th>
        <th>Pts</th>
        <th>DG</th>
        <th>GF</th>
        <th>GC</th>
        <th>PJ</th>
      </tr>
    </thead>
    <tbody>
      ${teams
        .map(
          (t) => `
        <tr>
          <td>${t.puesto}. ${t.pais}</td>
          <td>${t.pts}</td>
          <td>${t.DG}</td>
          <td>${t.GF}</td>
          <td>${t.GC}</td>
          <td>${t.pj}</td>
        </tr>`
        )
        .join("")}
    </tbody>`;

  const link = document.createElement("a");
  link.href = `/grupo.html?g=${encodeURIComponent(groupId)}`;
  link.className = "button";
  link.textContent = "Editar resultados";

  card.append(header, table, link);
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

async function render() {
  groupsContainer.innerHTML = "<p class='subtitle'>Cargando grupos…</p>";
  setStatus("Sincronizando", "neutral");
  try {
    const data = await fetchGroups();
    groupsContainer.innerHTML = "";
    const groups = data.grupos;
    const keys = Object.keys(groups).sort();
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

refreshBtn?.addEventListener("click", render);
render();
