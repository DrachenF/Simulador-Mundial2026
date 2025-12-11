const grid = document.getElementById("bracket-grid");
const syncBtn = document.getElementById("sync");
const statusEl = document.getElementById("status");
let saveTimer;

function shortName(name) {
  if (!name) return "";
  return name.length > 18 ? `${name.slice(0, 16)}…` : name;
}

function matchCard(match) {
  const card = document.createElement("div");
  card.className = "bracket-match";
  card.dataset.id = match.id;
  const needsPens = match.goles1 !== null && match.goles2 !== null && match.goles1 === match.goles2;

  const makeInput = (value, cls) => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = value ?? "";
    input.className = cls;
    input.addEventListener("input", () => scheduleSave(match.id));
    return input;
  };

  const row = (team, gKey, pKey) => {
    const wrap = document.createElement("div");
    wrap.className = "bracket-row";
    const name = document.createElement("span");
    name.className = "team";
    name.textContent = team || "";

    const goals = makeInput(match[gKey], "score-input");
    goals.name = gKey;
    goals.placeholder = "";

    const penBox = document.createElement("div");
    penBox.className = `pen-box ${needsPens || match[pKey] !== null ? "" : "hidden"}`;
    const pen = makeInput(match[pKey], "score-input pen");
    pen.name = pKey;
    pen.placeholder = "p";
    penBox.append("P", pen);

    wrap.append(name, goals, penBox);
    return wrap;
  };

  const header = document.createElement("div");
  header.className = "bracket-header";
  header.textContent = `${match.round} · Llave ${match.id}`;

  card.append(
    header,
    row(match.equipo1, "goles1", "pen1"),
    row(match.equipo2, "goles2", "pen2"),
  );

  const winner = document.createElement("div");
  winner.className = "winner";
  winner.textContent = match.ganador ? `→ ${shortName(match.ganador)}` : "";
  card.appendChild(winner);

  return card;
}

function render(bracket) {
  if (!bracket?.rounds) return;
  grid.innerHTML = "";
  bracket.rounds.forEach((round) => {
    const col = document.createElement("div");
    col.className = "bracket-column";
    const title = document.createElement("h3");
    title.textContent = round.label;
    col.appendChild(title);
    round.matches.forEach((match) => col.appendChild(matchCard(match)));
    grid.appendChild(col);
  });
}

async function loadBracket() {
  statusEl.textContent = "Cargando...";
  try {
    const res = await fetch("/api/bracket");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || "Error al cargar llaves");
    render(data);
    statusEl.textContent = "Listo";
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

async function save(matchId) {
  const card = grid.querySelector(`.bracket-match[data-id="${matchId}"]`);
  if (!card) return;
  const payload = { matchId };
  card.querySelectorAll("input").forEach((input) => {
    const value = input.value.trim();
    payload[input.name] = value === "" ? null : Number.parseInt(value, 10);
  });

  statusEl.textContent = "Actualizando...";
  const res = await fetch("/api/bracket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    statusEl.textContent = data?.error || "No se pudo guardar";
    return;
  }
  render(data);
  statusEl.textContent = "Actualizado";
}

function scheduleSave(matchId) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(matchId), 200);
}

syncBtn?.addEventListener("click", () => loadBracket());
grid?.addEventListener("input", (event) => {
  const card = event.target.closest(".bracket-match");
  if (!card) return;
  const matchId = Number(card.dataset.id);
  scheduleSave(matchId);
});

loadBracket();
