const BOARD_SIZE = 50;
const SPECIAL_STORAGE_KEY = "ieum-yutgame-special-cells-v1";
const SOUND_STORAGE_KEY = "ieum-yutgame-sound-v1";

const BOARD_PATH = Array.from({ length: BOARD_SIZE }, (_, index) => {
  const cell = index + 1;
  const row = Math.floor(index / 10);
  const colInRow = index % 10;
  const col = row % 2 === 0 ? colInRow : 9 - colInRow;
  const progress = col / 9;
  const wave = Math.sin(progress * Math.PI);
  const baseY = 650 - row * 150;
  const rowWave = row % 2 === 0 ? -18 : 18;
  const x = 220 + col * 94;
  const y = baseY + wave * rowWave;
  const rotate = row % 2 === 0 ? -8 + progress * 16 : 8 - progress * 16;
  return { cell, x, y, rotate };
});
const PLAYER_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f97316", "#14b8a6", "#eab308", "#ec4899", "#6366f1", "#84cc16"];
const SPECIAL_ICONS = {
  mission: "⭐",
  bonus: "🎁",
  penalty: "⚠️",
  event: "🎲",
  purple: "✨",
};

const state = {
  screen: "special",
  players: [],
  selectedPlayerId: null,
  specialCells: new Map(),
  finishOrder: [],
  soundEnabled: true,
  musicEnabled: false,
};

const audioState = {
  context: null,
  musicTimer: null,
  musicStep: 0,
};

const $ = (id) => document.getElementById(id);

const elements = {
  specialSetupScreen: $("special-setup-screen"),
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
  specialMessage: $("special-message"),
  continueToPlayers: $("continue-to-players"),
  backToSpecial: $("back-to-special"),
  specialCell: $("special-cell"),
  specialTitle: $("special-title"),
  specialDescription: $("special-description"),
  specialColor: $("special-color"),
  specialList: $("special-list"),
  saveSpecialConfig: $("save-special-config"),
  loadSpecialConfig: $("load-special-config"),
  clearSpecialConfig: $("clear-special-config"),
  exportSpecialConfig: $("export-special-config"),
  importSpecialConfig: $("import-special-config"),
  toggleSound: $("toggle-sound"),
  toggleMusic: $("toggle-music"),
  podium: $("podium"),
  rankingList: $("ranking-list"),
  backToBoard: $("back-to-board"),
  resetGame: $("reset-game"),
  specialModal: $("special-modal"),
  specialModalCell: $("special-modal-cell"),
  specialModalTitle: $("special-modal-title"),
  specialModalDescription: $("special-modal-description"),
  specialModalClose: $("special-modal-close"),
  specialModalConfirm: $("special-modal-confirm"),
};

function showScreen(screen) {
  state.screen = screen;
  [elements.specialSetupScreen, elements.setupScreen, elements.boardScreen, elements.resultScreen].forEach((el) => el.classList.remove("screen--active"));
  if (screen === "special") elements.specialSetupScreen.classList.add("screen--active");
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

function announceSpecial(message) {
  elements.specialMessage.textContent = message;
}

function loadSoundPreferences() {
  try {
    const raw = localStorage.getItem(SOUND_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    state.soundEnabled = saved.soundEnabled !== false;
    state.musicEnabled = saved.musicEnabled === true;
  } catch (error) {
    state.soundEnabled = true;
    state.musicEnabled = false;
  }
}

function saveSoundPreferences() {
  try {
    localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify({
      soundEnabled: state.soundEnabled,
      musicEnabled: state.musicEnabled,
    }));
  } catch (error) {
    // Sound preferences are non-critical. Ignore storage failures.
  }
}

function updateSoundButtons() {
  elements.toggleSound.textContent = state.soundEnabled ? "효과음 켜짐" : "효과음 꺼짐";
  elements.toggleSound.setAttribute("aria-pressed", String(state.soundEnabled));
  elements.toggleMusic.textContent = state.musicEnabled ? "배경음악 끄기" : "배경음악 켜기";
  elements.toggleMusic.setAttribute("aria-pressed", String(state.musicEnabled));
  elements.toggleSound.classList.toggle("sound-button--off", !state.soundEnabled);
  elements.toggleMusic.classList.toggle("sound-button--on", state.musicEnabled);
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioState.context) audioState.context = new AudioContextClass();
  if (audioState.context.state === "suspended") audioState.context.resume();
  return audioState.context;
}

function playTone(frequency, duration = 0.12, delay = 0, type = "sine", volume = 0.035) {
  const context = getAudioContext();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playEffect(kind = "click") {
  if (!state.soundEnabled) return;
  const patterns = {
    click: [[660, 0.07, 0, "triangle", 0.025]],
    save: [[523, 0.08, 0], [784, 0.1, 0.08]],
    move: [[523, 0.08, 0], [659, 0.08, 0.07], [784, 0.1, 0.14]],
    special: [[784, 0.09, 0], [1047, 0.12, 0.08], [1319, 0.14, 0.17]],
    finish: [[523, 0.1, 0], [659, 0.1, 0.1], [784, 0.1, 0.2], [1047, 0.18, 0.32]],
    error: [[220, 0.1, 0, "sawtooth", 0.018], [196, 0.12, 0.1, "sawtooth", 0.016]],
  };
  (patterns[kind] || patterns.click).forEach(([frequency, duration, delay, type = "sine", volume = 0.035]) => {
    playTone(frequency, duration, delay, type, volume);
  });
}

function playMusicTick() {
  if (!state.musicEnabled) return;
  const melody = [392, 440, 523, 587, 659, 587, 523, 440];
  const bass = [196, 196, 220, 220, 262, 262, 220, 220];
  const index = audioState.musicStep % melody.length;
  playTone(melody[index], 0.18, 0, "sine", 0.018);
  if (index % 2 === 0) playTone(bass[index], 0.22, 0, "triangle", 0.012);
  audioState.musicStep += 1;
}

function startBackgroundMusic() {
  if (audioState.musicTimer) return;
  getAudioContext();
  playMusicTick();
  audioState.musicTimer = window.setInterval(playMusicTick, 420);
}

function stopBackgroundMusic() {
  if (!audioState.musicTimer) return;
  window.clearInterval(audioState.musicTimer);
  audioState.musicTimer = null;
}

function setMusicEnabled(enabled) {
  state.musicEnabled = enabled;
  if (enabled) startBackgroundMusic();
  else stopBackgroundMusic();
  saveSoundPreferences();
  updateSoundButtons();
}

function initializeSound() {
  loadSoundPreferences();
  updateSoundButtons();
  if (state.musicEnabled) {
    state.musicEnabled = false;
    saveSoundPreferences();
    updateSoundButtons();
  }
}

function serializeSpecialCells() {
  return [...state.specialCells.values()].sort((a, b) => a.cell - b.cell);
}

function createSpecialConfigPayload() {
  return {
    schema: "ieum-yutgame-special-cells-v1",
    exportedAt: new Date().toISOString(),
    boardSize: BOARD_SIZE,
    specialCells: serializeSpecialCells(),
  };
}

function normalizeSpecialCell(entry) {
  const cell = Number(entry?.cell);
  const title = String(entry?.title ?? "").trim();
  const description = String(entry?.description ?? "").trim();
  const color = ["mission", "bonus", "penalty", "event", "purple"].includes(entry?.color) ? entry.color : "mission";
  if (!Number.isInteger(cell) || cell < 1 || cell > BOARD_SIZE || !title || !description) return null;
  return { cell, title: title.slice(0, 10), description: description.slice(0, 80), color };
}

function saveSpecialConfigToStorage() {
  try {
    const payload = createSpecialConfigPayload();
    payload.savedAt = payload.exportedAt;
    localStorage.setItem(SPECIAL_STORAGE_KEY, JSON.stringify(payload));
    announceSpecial(`특별 칸 ${payload.specialCells.length}개 설정을 이 브라우저에 저장했습니다.`);
  } catch (error) {
    announceSpecial("브라우저 저장소에 저장하지 못했습니다. 저장 공간 또는 브라우저 설정을 확인하세요.");
  }
}

function loadSpecialConfigFromStorage() {
  try {
    const raw = localStorage.getItem(SPECIAL_STORAGE_KEY);
    if (!raw) {
      announceSpecial("저장된 특별 칸 설정이 없습니다.");
      return;
    }
    const payload = JSON.parse(raw);
    const loaded = Array.isArray(payload?.specialCells)
      ? payload.specialCells.map(normalizeSpecialCell).filter(Boolean)
      : [];
    state.specialCells = new Map(loaded.map((entry) => [entry.cell, entry]));
    renderBoard();
    renderSpecialList();
    const savedDate = payload?.savedAt ? new Date(payload.savedAt).toLocaleString("ko-KR") : "저장일시 없음";
    announceSpecial(`저장된 특별 칸 ${loaded.length}개를 불러왔습니다. (${savedDate})`);
  } catch (error) {
    announceSpecial("저장된 특별 칸 설정을 불러오지 못했습니다. 저장 데이터가 손상되었을 수 있습니다.");
  }
}

function clearSpecialConfigStorage() {
  try {
    localStorage.removeItem(SPECIAL_STORAGE_KEY);
    announceSpecial("브라우저에 저장된 특별 칸 설정을 삭제했습니다. 현재 화면의 설정은 유지됩니다.");
  } catch (error) {
    announceSpecial("저장본을 삭제하지 못했습니다. 브라우저 설정을 확인하세요.");
  }
}

function applySpecialConfigPayload(payload, sourceLabel) {
  const loaded = Array.isArray(payload?.specialCells)
    ? payload.specialCells.map(normalizeSpecialCell).filter(Boolean)
    : [];
  state.specialCells = new Map(loaded.map((entry) => [entry.cell, entry]));
  renderBoard();
  renderSpecialList();
  announceSpecial(`${sourceLabel}에서 특별 칸 ${loaded.length}개를 불러왔습니다.`);
}

function exportSpecialConfigToJson() {
  const payload = createSpecialConfigPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const link = document.createElement("a");
  link.href = url;
  link.download = `yutgame-special-cells-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  announceSpecial(`특별 칸 ${payload.specialCells.length}개 설정을 JSON 파일로 내보냈습니다.`);
}

function importSpecialConfigFromJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(String(reader.result ?? ""));
      applySpecialConfigPayload(payload, file.name);
    } catch (error) {
      announceSpecial("JSON 파일을 불러오지 못했습니다. 파일 형식을 확인하세요.");
    } finally {
      event.target.value = "";
    }
  });
  reader.addEventListener("error", () => {
    announceSpecial("JSON 파일을 읽지 못했습니다. 다시 시도하세요.");
    event.target.value = "";
  });
  reader.readAsText(file, "utf-8");
}

function openSpecialModal({ cell, title, description }) {
  elements.specialModalCell.textContent = `${cell}번 특별 칸`;
  elements.specialModalTitle.textContent = title;
  elements.specialModalDescription.textContent = description;
  elements.specialModal.hidden = false;
  elements.specialModal.classList.add("modal--open");
  elements.specialModalConfirm.focus();
}

function closeSpecialModal() {
  elements.specialModal.classList.remove("modal--open");
  elements.specialModal.hidden = true;
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
  playEffect("save");
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
    playEffect("error");
    return;
  }
  if (player.finished) {
    announce(`${player.name}님은 이미 도착했습니다.`, "warning");
    playEffect("error");
    return;
  }

  const destination = Math.max(1, Math.min(BOARD_SIZE, Number(targetCell)));
  player.position = destination;

  if (destination === BOARD_SIZE) {
    player.finished = true;
    player.finishedOrder = state.finishOrder.length + 1;
    state.finishOrder.push(player.id);
    announce(`🏁 ${player.name}님이 도착했습니다! 현재 ${player.finishedOrder}위입니다.`, "success");
    playEffect("finish");
  } else {
    const special = state.specialCells.get(destination);
    if (special) {
      announce(`${player.name}님이 ${destination}번 특별 칸에 도착했습니다. 팝업 내용을 확인하세요.`, "special");
      openSpecialModal(special);
      playEffect("special");
    } else {
      announce(`${player.name}님이 ${destination}번 칸으로 이동했습니다.`);
      playEffect("move");
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
    announceSpecial("특별 칸 번호는 1부터 50 사이로 입력하세요.");
    return;
  }
  if (!title) {
    announceSpecial("특별 칸 제목을 입력하세요.");
    return;
  }
  if (!description) {
    announceSpecial("특별 칸 설명을 입력하세요.");
    return;
  }

  state.specialCells.set(cell, { cell, title, description, color });
  elements.specialForm.reset();
  elements.specialColor.value = "mission";
  announceSpecial(`${cell}번 칸에 '${title}' 특별 칸을 저장했습니다.`);
  playEffect("save");
  renderBoard();
  renderSpecialList();
}

function removeSpecialCell(cell) {
  state.specialCells.delete(cell);
  renderBoard();
  renderSpecialList();
  announceSpecial(`${cell}번 특별 칸을 삭제했습니다.`);
  playEffect("click");
}

function startGame() {
  if (state.players.length < 1) {
    elements.setupMessage.textContent = "참여자를 1명 이상 추가해야 시작할 수 있습니다.";
    playEffect("error");
    return;
  }
  showScreen("board");
  state.selectedPlayerId = state.selectedPlayerId || state.players[0].id;
  renderAll();
  announce("참여자를 선택하고 원하는 칸을 클릭해 이동하세요.");
  playEffect("save");
}

function finishGame() {
  renderResults();
  showScreen("result");
  playEffect("finish");
}

function resetGame() {
  state.players = [];
  state.selectedPlayerId = null;
  state.specialCells = new Map();
  state.finishOrder = [];
  elements.setupMessage.textContent = "";
  showScreen("special");
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
  playEffect("save");
}

function boardCellsInPathOrder() {
  return BOARD_PATH;
}

function pointsToSmoothPath(points) {
  if (points.length === 0) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const row = Math.floor(index / 10);
    const isRowEnd = (index + 1) % 10 === 0;
    if (isRowEnd) {
      const controlX = row % 2 === 0 ? current.x + 86 : current.x - 86;
      const controlY = (current.y + next.y) / 2;
      path += ` Q ${controlX} ${controlY} ${next.x} ${next.y}`;
    } else {
      const controlX = (current.x + next.x) / 2;
      const controlY = Math.min(current.y, next.y) - (row % 2 === 0 ? 14 : -14);
      path += ` Q ${controlX} ${controlY} ${next.x} ${next.y}`;
    }
  }
  return path;
}

function renderBoardScenery() {
  const path = pointsToSmoothPath(BOARD_PATH);
  return `
    <svg class="board-track" viewBox="0 0 1280 760" aria-hidden="true" focusable="false">
      <path class="board-track__shadow" d="${path}" />
      <path class="board-track__line" d="${path}" />
    </svg>
    <div class="board-label board-label--start">출발</div>
    <div class="board-label board-label--end">도착</div>
    <div class="scenery scenery--moon">🌕</div>
    <div class="scenery scenery--rabbit">🐇</div>
    <div class="scenery scenery--kite-one">🪁</div>
    <div class="scenery scenery--kite-two">🪁</div>
    <div class="scenery scenery--rice-one">🌾</div>
    <div class="scenery scenery--rice-two">🌾</div>
    <div class="scenery scenery--drum">🥁</div>
    <div class="scenery scenery--songpyeon">🥮</div>
  `;
}

function renderBoard() {
  elements.board.innerHTML = `<div class="board-canvas">${renderBoardScenery()}</div>`;
  const boardCanvas = elements.board.querySelector(".board-canvas");
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
    boardCanvas.appendChild(cell);
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
  const specials = serializeSpecialCells();
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
  elements.continueToPlayers.addEventListener("click", () => showScreen("setup"));
  elements.backToSpecial.addEventListener("click", () => showScreen("special"));
  elements.startGame.addEventListener("click", startGame);
  elements.finishGame.addEventListener("click", finishGame);
  elements.specialForm.addEventListener("submit", saveSpecialCell);
  elements.saveSpecialConfig.addEventListener("click", saveSpecialConfigToStorage);
  elements.loadSpecialConfig.addEventListener("click", loadSpecialConfigFromStorage);
  elements.clearSpecialConfig.addEventListener("click", clearSpecialConfigStorage);
  elements.exportSpecialConfig.addEventListener("click", exportSpecialConfigToJson);
  elements.importSpecialConfig.addEventListener("change", importSpecialConfigFromJson);
  elements.toggleSound.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    saveSoundPreferences();
    updateSoundButtons();
    if (state.soundEnabled) playEffect("save");
  });
  elements.toggleMusic.addEventListener("click", () => {
    setMusicEnabled(!state.musicEnabled);
    if (state.musicEnabled) playEffect("special");
  });
  document.addEventListener("click", (event) => {
    const control = event.target.closest("button, .import-button");
    if (!control || control.id === "toggle-sound" || control.id === "toggle-music") return;
    playEffect("click");
  });
  elements.backToBoard.addEventListener("click", restartPositionsOnly);
  elements.resetGame.addEventListener("click", resetGame);
  elements.specialModalClose.addEventListener("click", closeSpecialModal);
  elements.specialModalConfirm.addEventListener("click", closeSpecialModal);
  elements.specialModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal]")) closeSpecialModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.specialModal.hidden) closeSpecialModal();
  });
}

initializeSound();
bindEvents();
renderAll();
