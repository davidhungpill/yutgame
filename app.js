const BOARD_SIZE = 50;

const BOARD_PATH = [
  [1, 150, 660, -8], [2, 245, 642, -4], [3, 340, 642, 2], [4, 432, 612, 18], [5, 485, 535, 84],
  [6, 465, 445, -18], [7, 365, 422, 0], [8, 265, 424, 0], [9, 168, 408, -8], [10, 105, 340, 80],
  [11, 105, 252, 90], [12, 108, 164, 84], [13, 165, 94, -18], [14, 270, 76, 0], [15, 378, 76, 0],
  [16, 485, 104, 28], [17, 525, 188, 88], [18, 524, 276, 84], [19, 568, 352, -10], [20, 672, 352, 0],
  [21, 778, 346, -6], [22, 850, 288, 84], [23, 850, 198, 88], [24, 898, 116, -8], [25, 1006, 100, 0],
  [26, 1112, 122, 22], [27, 1156, 206, 86], [28, 1152, 296, 88], [29, 1112, 380, -14], [30, 1008, 396, 0],
  [31, 900, 396, 0], [32, 792, 400, 2], [33, 688, 418, -10], [34, 652, 500, 88], [35, 652, 590, 88],
  [36, 708, 662, -14], [37, 812, 668, 0], [38, 918, 666, 2], [39, 1006, 620, -68], [40, 1026, 532, 88],
  [41, 1074, 456, -14], [42, 1170, 452, 0], [43, 1218, 372, 86], [44, 1218, 282, 88], [45, 1218, 192, 88],
  [46, 1184, 108, -24], [47, 1084, 72, 0], [48, 984, 72, 0], [49, 884, 78, 8], [50, 792, 104, 18],
].map(([cell, x, y, rotate]) => ({ cell, x, y, rotate }));
const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#eab308", "#ec4899", "#6366f1", "#84cc16"];
const SPECIAL_ICONS = {
  mission: "⭐",
  bonus: "🎁",
  penalty: "⚠️",
  event: "🎲",
  purple: "✨",
};

const state = {
  screen: "setup",
  players: [],
  selectedPlayerId: null,
  specialCells: new Map(),
  finishOrder: [],
};

const $ = (id) => document.getElementById(id);

const elements = {
  setupScreen: $("setup-screen"),
  boardScreen: $("board-screen"),
  resultScreen: $("result-screen"),
  playerForm: $("player-form"),
  playerName: $("player-name"),
  setupMessage: $("setup-message"),
  setupPlayerList: $("setup-player-list"),
  boardPlayerList: $("board-player-list"),
  playerCount: $("player-count"),
  startGame: $("start-game"),
  board: $("board"),
  selectedPlayerName: $("selected-player-name"),
  eventMessage: $("event-message"),
  finishGame: $("finish-game"),
  specialForm: $("special-form"),
  specialCell: $("special-cell"),
  specialTitle: $("special-title"),
  specialDescription: $("special-description"),
  specialColor: $("special-color"),
  specialList: $("special-list"),
  podium: $("podium"),
  rankingList: $("ranking-list"),
  backToBoard: $("back-to-board"),
  resetGame: $("reset-game"),
};

function showScreen(screen) {
  state.screen = screen;
  [elements.setupScreen, elements.boardScreen, elements.resultScreen].forEach((el) => el.classList.remove("screen--active"));
  if (screen === "setup") elements.setupScreen.classList.add("screen--active");
  if (screen === "board") elements.boardScreen.classList.add("screen--active");
  if (screen === "result") elements.resultScreen.classList.add("screen--active");
}

function nextPlayerId() {
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function playerInitial(name) {
  return Array.from(name.trim())[0] || "?";
}

function announce(message, type = "info") {
  elements.eventMessage.innerHTML = message;
  elements.eventMessage.dataset.type = type;
}

function addPlayer(name) {
  const normalized = name.trim();
  if (!normalized) {
    elements.setupMessage.textContent = "참여자 이름을 입력하세요.";
    return;
  }
  if (state.players.some((player) => player.name === normalized)) {
    elements.setupMessage.textContent = "같은 이름의 참여자가 이미 있습니다.";
    return;
  }
  const player = {
    id: nextPlayerId(),
    name: normalized,
    position: 0,
    finished: false,
    finishedOrder: null,
    color: PLAYER_COLORS[state.players.length % PLAYER_COLORS.length],
    registrationOrder: state.players.length + 1,
  };
  state.players.push(player);
  if (!state.selectedPlayerId) state.selectedPlayerId = player.id;
  elements.playerName.value = "";
  elements.setupMessage.textContent = `${normalized}님을 추가했습니다.`;
  renderAll();
}

function removePlayer(id) {
  state.players = state.players.filter((player) => player.id !== id);
  if (state.selectedPlayerId === id) {
    state.selectedPlayerId = state.players[0]?.id ?? null;
  }
  renderAll();
}

function selectPlayer(id) {
  state.selectedPlayerId = id;
  renderPlayers();
  renderSelectedPlayer();
}

function moveSelectedPlayer(targetCell) {
  const player = state.players.find((entry) => entry.id === state.selectedPlayerId);
  if (!player) {
    announce("먼저 이동할 참여자를 선택하세요.");
    return;
  }
  if (player.finished) {
    announce(`${player.name}님은 이미 도착했습니다.`, "warning");
    return;
  }

  const destination = Math.max(1, Math.min(BOARD_SIZE, Number(targetCell)));
  player.position = destination;

  if (destination === BOARD_SIZE) {
    player.finished = true;
    player.finishedOrder = state.finishOrder.length + 1;
    state.finishOrder.push(player.id);
    announce(`🏁 ${player.name}님이 도착했습니다! 현재 ${player.finishedOrder}위입니다.`, "success");
  } else {
    const special = state.specialCells.get(destination);
    if (special) {
      announce(`🎉 <strong>${player.name}</strong>님이 <strong>${destination}번 ${escapeHtml(special.title)}</strong>에 도착했습니다.<br>${escapeHtml(special.description)}`, "special");
    } else {
      announce(`${player.name}님이 ${destination}번 칸으로 이동했습니다.`);
    }
  }

  renderAll();

  if (state.players.length > 0 && state.players.every((entry) => entry.finished)) {
    renderResults();
    showScreen("result");
  }
}

function saveSpecialCell(event) {
  event.preventDefault();
  const cell = Number(elements.specialCell.value);
  const title = elements.specialTitle.value.trim();
  const description = elements.specialDescription.value.trim();
  const color = elements.specialColor.value;

  if (!Number.isInteger(cell) || cell < 1 || cell > BOARD_SIZE) {
    announce("특별 칸 번호는 1부터 50 사이로 입력하세요.", "warning");
    return;
  }
  if (!title) {
    announce("특별 칸 제목을 입력하세요.", "warning");
    return;
  }
  if (!description) {
    announce("특별 칸 설명을 입력하세요.", "warning");
    return;
  }

  state.specialCells.set(cell, { cell, title, description, color });
  elements.specialForm.reset();
  elements.specialColor.value = "mission";
  announce(`${cell}번 칸에 '${escapeHtml(title)}' 특별 칸을 저장했습니다.`, "success");
  renderBoard();
  renderSpecialList();
}

function removeSpecialCell(cell) {
  state.specialCells.delete(cell);
  renderBoard();
  renderSpecialList();
  announce(`${cell}번 특별 칸을 삭제했습니다.`);
}

function startGame() {
  if (state.players.length < 1) {
    elements.setupMessage.textContent = "참여자를 1명 이상 추가해야 시작할 수 있습니다.";
    return;
  }
  showScreen("board");
  state.selectedPlayerId = state.selectedPlayerId || state.players[0].id;
  renderAll();
  announce("참여자를 선택하고 원하는 칸을 클릭해 이동하세요.");
}

function finishGame() {
  renderResults();
  showScreen("result");
}

function resetGame() {
  state.players = [];
  state.selectedPlayerId = null;
  state.specialCells = new Map();
  state.finishOrder = [];
  elements.setupMessage.textContent = "";
  showScreen("setup");
  renderAll();
}

function restartPositionsOnly() {
  state.players.forEach((player) => {
    player.position = 0;
    player.finished = false;
    player.finishedOrder = null;
  });
  state.finishOrder = [];
  state.selectedPlayerId = state.players[0]?.id ?? null;
  showScreen("board");
  renderAll();
  announce("보드 화면으로 돌아왔습니다.");
}

function boardCellsInPathOrder() {
  return BOARD_PATH;
}

function renderBoardScenery() {
  const points = BOARD_PATH.map((point) => `${point.x},${point.y}`).join(" ");
  return `
    <svg class="board-track" viewBox="0 0 1280 760" aria-hidden="true" focusable="false">
      <polyline class="board-track__shadow" points="${points}" />
      <polyline class="board-track__line" points="${points}" />
    </svg>
    <div class="board-label board-label--start">START</div>
    <div class="board-label board-label--end">END</div>
    <div class="scenery scenery--sun">☀️</div>
    <div class="scenery scenery--moon">🌙</div>
    <div class="scenery scenery--rainbow">🌈</div>
    <div class="scenery scenery--cloud-one">☁️</div>
    <div class="scenery scenery--cloud-two">☁️</div>
    <div class="scenery scenery--star-one">⭐</div>
    <div class="scenery scenery--star-two">✦</div>
    <div class="scenery scenery--star-three">✦</div>
  `;
}

function renderBoard() {
  elements.board.innerHTML = renderBoardScenery();
  boardCellsInPathOrder().forEach(({ cell: cellNumber, x, y, rotate }) => {
    const cell = document.createElement("button");
    const special = state.specialCells.get(cellNumber);
    cell.type = "button";
    cell.className = "cell";
    cell.style.left = `${x}px`;
    cell.style.top = `${y}px`;
    cell.style.setProperty("--rotate", `${rotate}deg`);
    if (cellNumber === 1) cell.classList.add("start");
    if (cellNumber === BOARD_SIZE) cell.classList.add("finish");
    if (special) cell.classList.add(`special-${special.color}`);
    cell.setAttribute("aria-label", `${cellNumber}번 칸으로 이동`);
    cell.addEventListener("click", () => moveSelectedPlayer(cellNumber));

    const title = special ? special.title : cellNumber === 1 ? "출발" : cellNumber === BOARD_SIZE ? "완주" : "";
    const playersHere = state.players.filter((player) => player.position === cellNumber);
    cell.innerHTML = `
      <span class="cell__number">${String(cellNumber).padStart(2, "0")}</span>
      ${special ? `<span class="cell__icon" title="${escapeAttribute(special.description)}">${SPECIAL_ICONS[special.color] || "⭐"}</span>` : ""}
      <span class="cell__title">${escapeHtml(title)}</span>
      <span class="cell__tokens"></span>
    `;
    const tokenArea = cell.querySelector(".cell__tokens");
    playersHere.forEach((player) => tokenArea.appendChild(createToken(player)));
    elements.board.appendChild(cell);
  });
}

function createToken(player) {
  const token = document.createElement("span");
  token.className = "player-token";
  token.textContent = playerInitial(player.name);
  token.title = `${player.name} (${player.position}번)`;
  token.style.background = player.color;
  return token;
}

function renderPlayers() {
  renderSetupPlayers();
  renderBoardPlayers();
  elements.playerCount.textContent = `${state.players.length}명`;
  elements.startGame.disabled = state.players.length < 1;
}

function renderSetupPlayers() {
  elements.setupPlayerList.innerHTML = "";
  if (state.players.length === 0) {
    elements.setupPlayerList.innerHTML = `<li class="muted">아직 등록된 참여자가 없습니다.</li>`;
    return;
  }
  state.players.forEach((player) => {
    const item = document.createElement("li");
    item.className = "player-card";
    item.innerHTML = `
      <span class="player-token" style="background:${player.color}">${escapeHtml(playerInitial(player.name))}</span>
      <span class="player-card__main"><strong class="player-card__name">${escapeHtml(player.name)}</strong><span class="player-card__meta">등록 ${player.registrationOrder}번</span></span>
      <button class="icon-button" type="button" aria-label="${escapeAttribute(player.name)} 삭제">삭제</button>
    `;
    item.querySelector("button").addEventListener("click", () => removePlayer(player.id));
    elements.setupPlayerList.appendChild(item);
  });
}

function renderBoardPlayers() {
  elements.boardPlayerList.innerHTML = "";
  state.players.forEach((player) => {
    const item = document.createElement("li");
    item.className = `player-card ${player.id === state.selectedPlayerId ? "is-selected" : ""}`;
    const positionText = player.finished ? `도착 / ${player.finishedOrder}위` : player.position === 0 ? "출발 전" : `${player.position}번 칸`;
    item.innerHTML = `
      <span class="player-token" style="background:${player.color}">${escapeHtml(playerInitial(player.name))}</span>
      <span class="player-card__main"><strong class="player-card__name">${escapeHtml(player.name)}</strong><span class="player-card__meta">${positionText}</span></span>
      <button class="button" type="button">선택</button>
    `;
    item.querySelector("button").addEventListener("click", () => selectPlayer(player.id));
    elements.boardPlayerList.appendChild(item);
  });
}

function renderSelectedPlayer() {
  const player = state.players.find((entry) => entry.id === state.selectedPlayerId);
  elements.selectedPlayerName.textContent = player ? player.name : "없음";
}

function renderSpecialList() {
  elements.specialList.innerHTML = "";
  const specials = [...state.specialCells.values()].sort((a, b) => a.cell - b.cell);
  if (specials.length === 0) {
    elements.specialList.innerHTML = `<li class="muted">등록된 특별 칸이 없습니다.</li>`;
    return;
  }
  specials.forEach((special) => {
    const item = document.createElement("li");
    item.className = "special-item";
    item.innerHTML = `
      <strong>${special.cell}번 ${SPECIAL_ICONS[special.color] || "⭐"} ${escapeHtml(special.title)}</strong>
      <span>${escapeHtml(special.description)}</span>
      <button class="icon-button" type="button">삭제</button>
    `;
    item.querySelector("button").addEventListener("click", () => removeSpecialCell(special.cell));
    elements.specialList.appendChild(item);
  });
}

function renderResults() {
  const ranked = [...state.players].sort((a, b) => {
    if (a.finished && b.finished) return a.finishedOrder - b.finishedOrder;
    if (a.finished) return -1;
    if (b.finished) return 1;
    if (b.position !== a.position) return b.position - a.position;
    return a.registrationOrder - b.registrationOrder;
  });

  const medals = ["🥇", "🥈", "🥉"];
  elements.podium.innerHTML = ranked.slice(0, 3).map((player, index) => `
    <div class="medal-card">
      <span class="medal">${medals[index] || "🏅"}</span>
      <strong>${index + 1}위 ${escapeHtml(player.name)}</strong>
      <p>${player.finished ? "도착" : `${player.position}번 칸`}</p>
    </div>
  `).join("");

  elements.rankingList.innerHTML = ranked.map((player, index) => `
    <li><strong>${index + 1}위 ${escapeHtml(player.name)}</strong> — ${player.finished ? "도착" : `${player.position}번 칸`} ${player.finishedOrder ? `(도착 순서 ${player.finishedOrder})` : ""}</li>
  `).join("");
}

function renderAll() {
  renderPlayers();
  renderSelectedPlayer();
  renderBoard();
  renderSpecialList();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/'/g, "&#039;");
}

function bindEvents() {
  elements.playerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addPlayer(elements.playerName.value);
  });
  elements.startGame.addEventListener("click", startGame);
  elements.finishGame.addEventListener("click", finishGame);
  elements.specialForm.addEventListener("submit", saveSpecialCell);
  elements.backToBoard.addEventListener("click", restartPositionsOnly);
  elements.resetGame.addEventListener("click", resetGame);
}

bindEvents();
renderAll();
