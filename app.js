const SAMPLE_URL = "http://m.dhlottery.co.kr/?v=0955q010715172842q030712163541q202730353941q031328364445q021214192934";

const state = {
  pyodide: null,
  pyodideReady: false,
  scannerSupported: "BarcodeDetector" in window,
  scanning: false,
  scanFrameId: null,
  stream: null,
  parsed: null,
  excludeAllScanned: false,
  excludedGameIds: new Set(),
  manualExcludedNumbers: new Set(),
  generatedHistory: []
};

const els = {};

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  bindElements();
  bindEvents();
  renderNumberGrid();
  renderScannerSupport();
  setStatus("준비 중");
  setMessage("분석 엔진을 준비하고 있습니다.");
  initPyodide();
}

function bindElements() {
  els.statusText = document.querySelector("#statusText");
  els.messageText = document.querySelector("#messageText");
  els.cameraPreview = document.querySelector("#cameraPreview");
  els.cameraEmpty = document.querySelector("#cameraEmpty");
  els.startScanButton = document.querySelector("#startScanButton");
  els.stopScanButton = document.querySelector("#stopScanButton");
  els.scannerSupportText = document.querySelector("#scannerSupportText");
  els.manualInput = document.querySelector("#manualInput");
  els.analyzeButton = document.querySelector("#analyzeButton");
  els.sampleButton = document.querySelector("#sampleButton");
  els.emptyResult = document.querySelector("#emptyResult");
  els.resultContent = document.querySelector("#resultContent");
  els.roundText = document.querySelector("#roundText");
  els.excludeAllScanned = document.querySelector("#excludeAllScanned");
  els.gamesList = document.querySelector("#gamesList");
  els.numberGrid = document.querySelector("#numberGrid");
  els.excludedSummary = document.querySelector("#excludedSummary");
  els.availableCount = document.querySelector("#availableCount");
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
  els.resetButton.addEventListener("click", resetConditions);
}

async function initPyodide() {
  try {
    state.pyodide = await loadPyodide({
      indexURL: "./vendor/pyodide/"
    });
    const pythonCode = await fetch("./lotto.py").then((response) => {
      if (!response.ok) {
        throw new Error("lotto.py 파일을 불러오지 못했습니다.");
      }
      return response.text();
    });
    state.pyodide.runPython(pythonCode);
    state.pyodideReady = true;
    els.analyzeButton.disabled = false;
    els.generateButton.disabled = false;
    setStatus("준비 완료");
    setMessage("QR URL을 입력하거나 스캔을 시작하세요.", "success");
    parseCurrentUrl();
  } catch (error) {
    setStatus("오류");
    setMessage(error.message || "분석 엔진을 준비하지 못했습니다.", "error");
  }
}

function parseCurrentUrl() {
  if (window.location.search.includes("v=")) {
    analyzeRawQr(window.location.href);
  }
}

function activateTab(tabName) {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tabName);
  });
}

async function startScanner() {
  if (!state.scannerSupported) {
    setMessage("이 브라우저는 웹 QR 스캔을 지원하지 않습니다. QR URL을 직접 입력해 주세요.", "error");
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
    setMessage("QR 코드를 화면 안에 맞춰 주세요.");
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
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const codes = await detector.detect(els.cameraPreview);
    if (codes.length > 0) {
      const raw = codes[0].rawValue;
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

function analyzeRawQr(raw) {
  if (!state.pyodideReady) {
    setMessage("분석 엔진이 아직 준비 중입니다.", "error");
    return;
  }

  try {
    const parseFn = state.pyodide.globals.get("parse_lotto_qr_json");
    const result = JSON.parse(parseFn(raw));

    if (!result.ok) {
      setStatus("오류");
      setMessage(result.error, "error");
      return;
    }

    state.parsed = result.data;
    state.excludedGameIds.clear();
    state.excludeAllScanned = false;
    els.excludeAllScanned.checked = false;
    renderParsedResult();
    renderExclusionSummary();
    activateTab("result");
    setStatus("분석 완료");
    setMessage(`${result.data.round}회 QR을 분석했습니다.`, "success");
  } catch (error) {
    setStatus("오류");
    setMessage("QR 데이터를 분석하지 못했습니다.", "error");
  }
}

function renderParsedResult() {
  if (!state.parsed) {
    els.emptyResult.hidden = false;
    els.resultContent.hidden = true;
    return;
  }

  els.emptyResult.hidden = true;
  els.resultContent.hidden = false;
  els.roundText.textContent = `${state.parsed.round}회`;
  els.gamesList.innerHTML = "";

  state.parsed.games.forEach((game) => {
    const card = document.createElement("article");
    card.className = "game-card";

    const header = document.createElement("div");
    header.className = "game-header";

    const title = document.createElement("div");
    title.className = "game-title";
    title.innerHTML = `<span>${game.id} 게임</span><span class="selection-badge">${selectionText(game.selectionType)}</span>`;

    const label = document.createElement("label");
    label.className = "exclude-game";
    label.innerHTML = `<input type="checkbox" data-game-id="${game.id}"><span>제외</span>`;
    label.querySelector("input").addEventListener("change", (event) => {
      if (event.target.checked) {
        state.excludedGameIds.add(game.id);
      } else {
        state.excludedGameIds.delete(game.id);
      }
      renderExclusionSummary();
    });

    header.append(title, label);
    card.append(header, createBallsRow(game.numbers));
    els.gamesList.append(card);
  });
}

function renderNumberGrid() {
  els.numberGrid.innerHTML = "";
  for (let number = 1; number <= 45; number += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "number-toggle";
    button.textContent = String(number).padStart(2, "0");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      if (state.manualExcludedNumbers.has(number)) {
        state.manualExcludedNumbers.delete(number);
      } else {
        state.manualExcludedNumbers.add(number);
      }
      button.classList.toggle("is-selected", state.manualExcludedNumbers.has(number));
      button.setAttribute("aria-pressed", String(state.manualExcludedNumbers.has(number)));
      renderExclusionSummary();
    });
    els.numberGrid.append(button);
  }
}

function renderExclusionSummary() {
  const excluded = collectExcludedNumbers();
  const available = 45 - excluded.length;
  els.availableCount.textContent = `${available}개 후보`;

  if (excluded.length === 0) {
    els.excludedSummary.textContent = "제외된 번호가 없습니다.";
    return;
  }

  els.excludedSummary.textContent = excluded.map((number) => String(number).padStart(2, "0")).join(", ");
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
  if (!state.pyodideReady) {
    setMessage("분석 엔진이 아직 준비 중입니다.", "error");
    return;
  }

  const payload = {
    parsed: state.parsed,
    excludeAllScanned: state.excludeAllScanned,
    excludedGameIds: Array.from(state.excludedGameIds),
    manualExcludedNumbers: Array.from(state.manualExcludedNumbers)
  };

  const generateFn = state.pyodide.globals.get("generate_numbers_json");
  const result = JSON.parse(generateFn(JSON.stringify(payload)));

  if (!result.ok) {
    setStatus("오류");
    setMessage(result.error, "error");
    renderExclusionSummary();
    return;
  }

  state.generatedHistory.unshift(result.numbers);
  state.generatedHistory = state.generatedHistory.slice(0, 5);
  renderGeneratedNumbers(result.numbers);
  renderHistory();
  renderExclusionSummary();
  setStatus("생성 완료");
  setMessage("새 번호를 생성했습니다.", "success");
}

function renderGeneratedNumbers(numbers) {
  els.generatedResult.hidden = false;
  els.generatedBalls.innerHTML = "";
  els.generatedBalls.append(...numbers.map(createBall));
}

function renderHistory() {
  els.historySection.hidden = state.generatedHistory.length === 0;
  els.historyList.innerHTML = "";

  state.generatedHistory.forEach((numbers, index) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const label = document.createElement("strong");
    label.textContent = `#${index + 1}`;
    item.append(label, createBallsRow(numbers));
    els.historyList.append(item);
  });
}

function resetConditions() {
  state.excludeAllScanned = false;
  state.excludedGameIds.clear();
  state.manualExcludedNumbers.clear();
  els.excludeAllScanned.checked = false;
  document.querySelectorAll(".exclude-game input").forEach((input) => {
    input.checked = false;
  });
  document.querySelectorAll(".number-toggle").forEach((button) => {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });
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

function rangeClass(number) {
  if (number <= 10) return "range-1";
  if (number <= 20) return "range-2";
  if (number <= 30) return "range-3";
  if (number <= 40) return "range-4";
  return "range-5";
}

function selectionText(type) {
  return type === "manual" ? "수동" : "자동";
}

function renderScannerSupport() {
  if (state.scannerSupported) {
    els.scannerSupportText.textContent = "이 브라우저는 웹 QR 스캔을 지원합니다. iPhone에서는 기본 카메라 앱으로 QR을 열어도 됩니다.";
  } else {
    els.scannerSupportText.textContent = "이 브라우저는 웹 QR 스캔을 지원하지 않을 수 있습니다. iPhone은 기본 카메라 앱으로 QR을 열거나 URL을 직접 입력해 주세요.";
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
