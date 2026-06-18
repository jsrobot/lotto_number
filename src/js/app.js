const SAMPLE_URL = "https://m.dhlottery.co.kr/?v=0955q010715172842q030712163541q202730353941q031328364445q021214192934";
const TAB_ORDER = ["scan", "result", "generate"];
const DEFAULT_GAME_COUNT = 5;
const SWIPE_MIN_DISTANCE = 50;
const SWIPE_MAX_VERTICAL_RATIO = 0.8;

const state = {
  barcodeDetectorSupported: "BarcodeDetector" in window,
  barcodeDetectorFailed: false,
  jsQrSupported: typeof window.jsQR === "function",
  scanning: false,
  scanFrameId: null,
  stream: null,
  parsed: null,
  excludeAllScanned: false,
  excludedGameIds: new Set(),
  manualExcludedNumbers: new Set(),
  generatedHistory: [],
  activeTab: "scan",
  gameCount: DEFAULT_GAME_COUNT,
  touchStartX: null,
  touchStartY: null
};

const els = {};

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  bindElements();
  bindEvents();
  renderNumberGrid();
  renderScannerSupport();
  setStatus("준비 완료");
  setMessage("QR URL을 입력하거나 사진 인식을 시작하세요.", "success");
  els.analyzeButton.disabled = false;
  els.generateButton.disabled = false;
  parseCurrentUrl();
}

function bindElements() {
  els.statusText = document.querySelector("#statusText");
  els.messageText = document.querySelector("#messageText");
  els.cameraPreview = document.querySelector("#cameraPreview");
  els.cameraEmpty = document.querySelector("#cameraEmpty");
  els.photoInput = document.querySelector("#photoInput");
  els.qrCanvas = document.querySelector("#qrCanvas");
  els.startScanButton = document.querySelector("#startScanButton");
  els.stopScanButton = document.querySelector("#stopScanButton");
  els.scannerSupportText = document.querySelector("#scannerSupportText");
  els.manualInput = document.querySelector("#manualInput");
  els.analyzeButton = document.querySelector("#analyzeButton");
  els.sampleButton = document.querySelector("#sampleButton");
  els.emptyResult = document.querySelector("#emptyResult");
  els.scanFlowContent = document.querySelector("#scanFlowContent");
  els.scanRoundText = document.querySelector("#scanRoundText");
  els.scanExtraDataText = document.querySelector("#scanExtraDataText");
  els.scanGamesList = document.querySelector("#scanGamesList");
  els.scanAvailableCount = document.querySelector("#scanAvailableCount");
  els.scanExcludedSummary = document.querySelector("#scanExcludedSummary");
  els.scanGameCountSelect = document.querySelector("#scanGameCountSelect");
  els.scanGenerateButton = document.querySelector("#scanGenerateButton");
  els.scanGeneratedResult = document.querySelector("#scanGeneratedResult");
  els.scanGeneratedBalls = document.querySelector("#scanGeneratedBalls");
  els.resultContent = document.querySelector("#resultContent");
  els.roundText = document.querySelector("#roundText");
  els.extraDataText = document.querySelector("#extraDataText");
  els.excludeAllScanned = document.querySelector("#excludeAllScanned");
  els.gamesList = document.querySelector("#gamesList");
  els.numberGrid = document.querySelector("#numberGrid");
  els.excludedSummary = document.querySelector("#excludedSummary");
  els.availableCount = document.querySelector("#availableCount");
  els.gameCountSelect = document.querySelector("#gameCountSelect");
  els.generateButton = document.querySelector("#generateButton");
  els.generatedResult = document.querySelector("#generatedResult");
  els.generatedBalls = document.querySelector("#generatedBalls");
  els.historySection = document.querySelector("#historySection");
  els.historyList = document.querySelector("#historyList");
  els.resetButton = document.querySelector("#resetButton");
}

function bindEvents() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  els.startScanButton.addEventListener("click", startScanner);
  els.stopScanButton.addEventListener("click", stopScanner);
  els.photoInput.addEventListener("change", processPhotoInput);
  els.analyzeButton.addEventListener("click", () => analyzeRawQr(els.manualInput.value));
  els.sampleButton.addEventListener("click", () => {
    els.manualInput.value = SAMPLE_URL;
    analyzeRawQr(SAMPLE_URL);
  });

  els.excludeAllScanned.addEventListener("change", () => {
    state.excludeAllScanned = els.excludeAllScanned.checked;
    renderExclusionSummary();
  });

  els.generateButton.addEventListener("click", generateNumbers);
  els.scanGenerateButton.addEventListener("click", generateNumbers);
  els.resetButton.addEventListener("click", resetConditions);
  els.gameCountSelect.addEventListener("change", syncGameCount);
  els.scanGameCountSelect.addEventListener("change", syncGameCount);
  document.querySelector(".app-shell").addEventListener("touchstart", handleTouchStart, { passive: true });
  document.querySelector(".app-shell").addEventListener("touchend", handleTouchEnd, { passive: true });
}

function parseCurrentUrl() {
  if (window.location.search.includes("v=")) {
    analyzeRawQr(window.location.href);
  }
}

function activateTab(tabName) {
  if (!TAB_ORDER.includes(tabName)) {
    return;
  }

  state.activeTab = tabName;

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });

  document.querySelectorAll(".swipe-dot").forEach((dot) => {
    dot.classList.toggle("is-active", dot.dataset.tabDot === tabName);
  });
}

function syncGameCount(event) {
  const count = normalizeGameCount(event.target.value);
  state.gameCount = count;
  els.gameCountSelect.value = String(count);
  els.scanGameCountSelect.value = String(count);
}

function normalizeGameCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count)) {
    return DEFAULT_GAME_COUNT;
  }
  return Math.min(5, Math.max(1, count));
}

function handleTouchStart(event) {
  if (event.touches.length !== 1) {
    state.touchStartX = null;
    state.touchStartY = null;
    return;
  }

  state.touchStartX = event.touches[0].clientX;
  state.touchStartY = event.touches[0].clientY;
}

function handleTouchEnd(event) {
  if (state.touchStartX == null || state.touchStartY == null || event.changedTouches.length !== 1) {
    return;
  }

  const deltaX = event.changedTouches[0].clientX - state.touchStartX;
  const deltaY = event.changedTouches[0].clientY - state.touchStartY;
  state.touchStartX = null;
  state.touchStartY = null;

  if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE) {
    return;
  }

  if (Math.abs(deltaY) > Math.abs(deltaX) * SWIPE_MAX_VERTICAL_RATIO) {
    return;
  }

  const currentIndex = TAB_ORDER.indexOf(state.activeTab);
  const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
  const nextTab = TAB_ORDER[nextIndex];

  if (nextTab) {
    activateTab(nextTab);
  }
}

async function startScanner() {
  if (!state.barcodeDetectorSupported && !state.jsQrSupported) {
    setMessage("이 브라우저에서 사용할 QR 인식 엔진을 찾지 못했습니다. QR URL을 직접 입력해 주세요.", "error");
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setMessage("이 브라우저에서는 카메라를 사용할 수 없습니다.", "error");
    return;
  }

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    els.cameraPreview.srcObject = state.stream;
    await els.cameraPreview.play();
    state.scanning = true;
    els.cameraEmpty.hidden = true;
    els.startScanButton.disabled = true;
    els.stopScanButton.disabled = false;
    setStatus("QR 대기 중");
    setMessage("QR 코드를 화면 안에 맞춰 주세요. iPhone에서도 실시간 인식을 시도합니다.");
    scanFrame();
  } catch (error) {
    setMessage("카메라 권한을 확인하거나 QR URL을 직접 입력해 주세요.", "error");
  }
}

function stopScanner() {
  state.scanning = false;

  if (state.scanFrameId) {
    cancelAnimationFrame(state.scanFrameId);
    state.scanFrameId = null;
  }

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  els.cameraPreview.srcObject = null;
  els.cameraEmpty.hidden = false;
  els.startScanButton.disabled = false;
  els.stopScanButton.disabled = true;
  setStatus(state.parsed ? "분석 완료" : "준비 완료");
}

async function scanFrame() {
  if (!state.scanning) {
    return;
  }

  try {
    const raw = await detectQrFromVideo();
    if (raw) {
      stopScanner();
      els.manualInput.value = raw;
      analyzeRawQr(raw);
      return;
    }
  } catch (error) {
    stopScanner();
    setMessage("QR 스캔 중 오류가 발생했습니다. URL 직접 입력을 사용해 주세요.", "error");
    return;
  }

  state.scanFrameId = requestAnimationFrame(scanFrame);
}

async function detectQrFromVideo() {
  if (state.barcodeDetectorSupported && !state.barcodeDetectorFailed) {
    try {
      const detector = new BarcodeDetector({ formats: ["qr_code"] });
      const codes = await detector.detect(els.cameraPreview);
      if (codes.length > 0) {
        return codes[0].rawValue;
      }
    } catch (error) {
      state.barcodeDetectorFailed = true;
    }
  }

  if (state.jsQrSupported) {
    return decodeQrFromCanvasSource(els.cameraPreview);
  }

  return null;
}

function processPhotoInput(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    return;
  }

  if (!state.jsQrSupported) {
    setMessage("사진 인식을 위한 QR 엔진을 불러오지 못했습니다.", "error");
    event.target.value = "";
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    try {
      const raw = decodeQrFromCanvasSource(image);
      if (!raw) {
        setStatus("오류");
        setMessage("사진에서 QR 코드를 찾지 못했습니다. QR이 선명하게 보이도록 다시 촬영해 주세요.", "error");
        return;
      }

      stopScanner();
      els.manualInput.value = raw;
      analyzeRawQr(raw);
    } catch (error) {
      setStatus("오류");
      setMessage("사진을 분석하지 못했습니다. 다른 사진을 선택해 주세요.", "error");
    } finally {
      URL.revokeObjectURL(objectUrl);
      event.target.value = "";
    }
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    event.target.value = "";
    setStatus("오류");
    setMessage("이미지 파일을 읽지 못했습니다.", "error");
  };

  setStatus("사진 분석 중");
  setMessage("사진에서 QR 코드를 찾고 있습니다.");
  image.src = objectUrl;
}

function decodeQrFromCanvasSource(source) {
  const canvas = els.qrCanvas;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const sourceWidth = source.videoWidth || source.naturalWidth || source.width;
  const sourceHeight = source.videoHeight || source.naturalHeight || source.height;

  if (!sourceWidth || !sourceHeight) {
    return null;
  }

  const maxSize = 1400;
  const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  canvas.width = width;
  canvas.height = height;
  context.drawImage(source, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth"
  });

  return code ? code.data : null;
}

function analyzeRawQr(raw) {
  try {
    const result = window.Lotto.parseLottoQr(raw);

    if (!result.ok) {
      setStatus("오류");
      setMessage(result.error, "error");
      return;
    }

    resetAnalysisStateForNewQr();
    state.parsed = result.data;
    renderParsedResult();
    renderExclusionSummary();
    setStatus("분석 완료");
    setMessage(`${result.data.round}회 QR을 분석했습니다.`, "success");
  } catch (error) {
    setStatus("오류");
    setMessage("QR 데이터를 분석하지 못했습니다.", "error");
  }
}

function resetAnalysisStateForNewQr() {
  state.excludeAllScanned = false;
  state.excludedGameIds.clear();
  state.manualExcludedNumbers.clear();
  state.generatedHistory = [];

  els.excludeAllScanned.checked = false;
  els.generatedResult.hidden = true;
  els.scanGeneratedResult.hidden = true;
  els.historySection.hidden = true;
  els.generatedBalls.innerHTML = "";
  els.scanGeneratedBalls.innerHTML = "";
  els.historyList.innerHTML = "";
}

function renderParsedResult() {
  if (!state.parsed) {
    els.emptyResult.hidden = false;
    els.resultContent.hidden = true;
    els.scanFlowContent.hidden = true;
    return;
  }

  els.emptyResult.hidden = true;
  els.resultContent.hidden = false;
  els.scanFlowContent.hidden = false;
  renderResultHeader(els.roundText, els.extraDataText);
  renderResultHeader(els.scanRoundText, els.scanExtraDataText);
  renderGameRows(els.gamesList);
  renderGameRows(els.scanGamesList);
}

function renderResultHeader(roundEl, extraEl) {
  roundEl.textContent = `${state.parsed.round}회`;
  if (state.parsed.hasExtraData) {
    extraEl.hidden = false;
    extraEl.textContent = `부가 정보 ${state.parsed.extraData}`;
  } else {
    extraEl.hidden = true;
    extraEl.textContent = "";
  }
}

function renderGameRows(container) {
  container.innerHTML = "";

  const table = document.createElement("div");
  table.className = "games-table";

  state.parsed.games.forEach((game) => {
    const row = document.createElement("div");
    row.className = "game-row";

    const gameCell = document.createElement("strong");
    gameCell.className = "game-cell";
    gameCell.textContent = `${game.id}게임`;

    const typeCell = document.createElement("span");
    typeCell.className = "selection-badge";
    typeCell.textContent = selectionText(game.selectionType);

    const numbersCell = document.createElement("div");
    numbersCell.className = "game-numbers-cell";
    numbersCell.append(...game.numbers.map(createMiniBall));

    const label = document.createElement("label");
    label.className = "exclude-game row-exclude";
    label.innerHTML = `<input type="checkbox" data-game-id="${game.id}"><span>제외</span>`;
    const input = label.querySelector("input");
    input.checked = state.excludedGameIds.has(game.id);
    input.addEventListener("change", (event) => {
      if (event.target.checked) {
        state.excludedGameIds.add(game.id);
      } else {
        state.excludedGameIds.delete(game.id);
      }
      renderParsedResult();
      renderExclusionSummary();
    });

    row.append(gameCell, typeCell, numbersCell, label);
    table.append(row);
  });

  container.append(table);
}

function renderNumberGrid() {
  els.numberGrid.innerHTML = "";
  for (let number = 1; number <= 45; number += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "number-toggle";
    button.dataset.number = String(number);
    button.textContent = String(number).padStart(2, "0");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      if (state.manualExcludedNumbers.has(number)) {
        state.manualExcludedNumbers.delete(number);
      } else {
        state.manualExcludedNumbers.add(number);
      }
      renderExclusionSummary();
    });
    els.numberGrid.append(button);
  }
  renderNumberGridSelection();
}

function renderExclusionSummary() {
  const excluded = collectExcludedNumbers();
  const available = 45 - excluded.length;
  els.availableCount.textContent = `${available}개 후보`;
  els.scanAvailableCount.textContent = `${available}개 후보`;

  if (excluded.length === 0) {
    els.excludedSummary.textContent = "제외된 번호가 없습니다.";
    els.scanExcludedSummary.textContent = "제외된 번호가 없습니다.";
    renderNumberGridSelection();
    return;
  }

  const summary = excluded.map((number) => String(number).padStart(2, "0")).join(", ");
  els.excludedSummary.textContent = summary;
  els.scanExcludedSummary.textContent = summary;
  renderNumberGridSelection();
}

function renderNumberGridSelection() {
  const excluded = new Set(collectExcludedNumbers());
  document.querySelectorAll(".number-toggle").forEach((button) => {
    const number = Number(button.dataset.number);
    const selected = excluded.has(number);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function collectExcludedNumbers() {
  const excluded = new Set();
  const games = state.parsed?.games || [];

  if (state.excludeAllScanned) {
    games.forEach((game) => game.numbers.forEach((number) => excluded.add(number)));
  }

  games.forEach((game) => {
    if (state.excludedGameIds.has(game.id)) {
      game.numbers.forEach((number) => excluded.add(number));
    }
  });

  state.manualExcludedNumbers.forEach((number) => excluded.add(number));
  return Array.from(excluded).sort((a, b) => a - b);
}

function generateNumbers() {
  const payload = {
    parsed: state.parsed,
    excludeAllScanned: state.excludeAllScanned,
    excludedGameIds: Array.from(state.excludedGameIds),
    manualExcludedNumbers: Array.from(state.manualExcludedNumbers),
    gameCount: state.gameCount
  };

  const result = window.Lotto.generateNumbers(payload);

  if (!result.ok) {
    setStatus("오류");
    setMessage(result.error, "error");
    renderExclusionSummary();
    return;
  }

  state.generatedHistory.unshift(result.games);
  state.generatedHistory = state.generatedHistory.slice(0, 5);
  renderGeneratedNumbers(result.games);
  renderHistory();
  renderExclusionSummary();
  setStatus("생성 완료");
  setMessage(`${result.gameCount}게임 번호를 생성했습니다.`, "success");
}

function renderGeneratedNumbers(games) {
  els.generatedResult.hidden = false;
  els.scanGeneratedResult.hidden = false;
  els.generatedBalls.innerHTML = "";
  els.scanGeneratedBalls.innerHTML = "";
  els.generatedBalls.append(...games.map(createGeneratedGameRow));
  els.scanGeneratedBalls.append(...games.map(createGeneratedGameRow));
}

function renderHistory() {
  els.historySection.hidden = state.generatedHistory.length === 0;
  els.historyList.innerHTML = "";

  state.generatedHistory.forEach((games, index) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const label = document.createElement("strong");
    label.textContent = `#${index + 1}`;
    const list = document.createElement("div");
    list.className = "generated-games-list";
    list.append(...games.map(createGeneratedGameRow));
    item.append(label, list);
    els.historyList.append(item);
  });
}

function createGeneratedGameRow(game) {
  const row = document.createElement("div");
  row.className = "generated-game-row";
  const label = document.createElement("strong");
  label.className = "generated-game-label";
  label.textContent = `${game.id}게임`;
  row.append(label, createBallsRow(game.numbers));
  return row;
}

function resetConditions() {
  state.excludeAllScanned = false;
  state.excludedGameIds.clear();
  state.manualExcludedNumbers.clear();
  els.excludeAllScanned.checked = false;
  renderParsedResult();
  renderExclusionSummary();
  setMessage("제외 조건을 초기화했습니다.", "success");
}

function createBallsRow(numbers) {
  const row = document.createElement("div");
  row.className = "balls-row";
  row.append(...numbers.map(createBall));
  return row;
}

function createBall(number) {
  const ball = document.createElement("span");
  ball.className = `ball ${rangeClass(number)}`;
  ball.textContent = String(number).padStart(2, "0");
  return ball;
}

function createMiniBall(number) {
  const ball = createBall(number);
  ball.classList.add("ball-mini");
  return ball;
}

function rangeClass(number) {
  return `range-${Math.ceil(number / 5)}`;
}

function selectionText(type) {
  return type === "manual" ? "수동" : "자동";
}

function renderScannerSupport() {
  if (state.jsQrSupported) {
    els.scannerSupportText.textContent = "실시간 스캔 우선. 실패하면 사진 선택을 사용하세요.";
  } else if (state.barcodeDetectorSupported) {
    els.scannerSupportText.textContent = "사진 인식 엔진을 불러오지 못했지만, 이 브라우저의 기본 QR 스캔을 시도할 수 있습니다.";
  } else {
    els.scannerSupportText.textContent = "이 브라우저는 웹 QR 스캔을 지원하지 않을 수 있습니다. QR URL을 직접 입력해 주세요.";
  }
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function setMessage(text, tone) {
  els.messageText.textContent = text;
  els.messageText.classList.toggle("is-error", tone === "error");
  els.messageText.classList.toggle("is-success", tone === "success");
}
