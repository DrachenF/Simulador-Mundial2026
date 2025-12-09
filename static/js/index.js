const groupsContainer = document.getElementById("groups");
const refreshBtn = document.getElementById("refresh");

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

async function render() {
  groupsContainer.innerHTML = "<p class='subtitle'>Cargando grupos…</p>";
  try {
    const data = await fetchGroups();
    groupsContainer.innerHTML = "";
    const groups = data.grupos;
    Object.keys(groups)
      .sort()
      .forEach((g) => {
        groupsContainer.appendChild(renderGroupCard(g, groups[g]));
      });
  } catch (err) {
    groupsContainer.innerHTML = `<p class='subtitle'>${err.message}</p>`;
  }
}

refreshBtn?.addEventListener("click", render);
render();
