(function () {
  const MAX_GAMES = 5;
  const SELECTION_LABELS = {
    q: "auto",
    m: "manual"
  };

  function ok(data) {
    return { ok: true, data };
  }

  function error(message, extra = {}) {
    return { ok: false, error: message, ...extra };
  }

  function selectionLabel(selectionCode) {
    return SELECTION_LABELS[selectionCode];
  }

  function extractVValue(raw) {
    if (raw == null) {
      return "";
    }

    const text = String(raw).trim();
    if (!text) {
      return "";
    }

    try {
      const url = new URL(text, window.location.href);
      const value = url.searchParams.get("v");
      if (value) {
        return decodeURIComponent(value).trim();
      }
    } catch (event) {
      // Fall through to query-string parsing below.
    }

    const queryText = text.startsWith("?") ? text.slice(1) : text;
    if (queryText.startsWith("v=") || queryText.includes("&v=")) {
      const params = new URLSearchParams(queryText);
      const value = params.get("v");
      if (value) {
        return decodeURIComponent(value).trim();
      }
    }

    const match = text.match(/[?&]v=([^&#]+)/);
    if (match) {
      return decodeURIComponent(match[1]).trim();
    }

    return text;
  }

  function validateGame(numbers, gameId) {
    if (numbers.length !== 6) {
      return `게임 ${gameId}의 번호는 6개여야 합니다.`;
    }

    if (new Set(numbers).size !== 6) {
      return `게임 ${gameId}에 중복 번호가 있습니다.`;
    }

    const invalid = numbers.find((number) => number < 1 || number > 45);
    if (invalid != null) {
      return `게임 ${gameId}의 번호 ${String(invalid).padStart(2, "0")}는 1~45 범위를 벗어났습니다.`;
    }

    return null;
  }

  function parseGameSegment(selectionCode, segment, gameId) {
    const label = selectionLabel(selectionCode);
    if (!label) {
      return error(`게임 ${gameId}의 선택 유형을 알 수 없습니다.`);
    }

    if (!/^\d{12}$/.test(segment || "")) {
      return error(`게임 ${gameId}의 번호 데이터가 올바르지 않습니다.`);
    }

    const numbers = [];
    for (let index = 0; index < 12; index += 2) {
      numbers.push(Number(segment.slice(index, index + 2)));
    }

    const validationError = validateGame(numbers, gameId);
    if (validationError) {
      return error(validationError);
    }

    return ok({
      id: gameId,
      selectionType: label,
      selectionCode,
      numbers
    });
  }

  function parseGames(value) {
    if (value.length < 17) {
      return error("QR 번호 데이터가 부족합니다.");
    }

    const roundText = value.slice(0, 4);
    if (!/^\d{4}$/.test(roundText)) {
      return error("회차 정보가 올바르지 않습니다.");
    }

    const body = value.slice(4);
    if (!body) {
      return error("게임 번호 데이터가 없습니다.");
    }

    const games = [];
    let cursor = 0;

    while (cursor < body.length && games.length < MAX_GAMES) {
      const selectionCode = body.slice(cursor, cursor + 1);

      if (!SELECTION_LABELS[selectionCode]) {
        if (games.length > 0) {
          break;
        }
        return error(`지원하지 않는 선택 유형 '${selectionCode}'가 포함되어 있습니다.`);
      }

      if (cursor + 13 > body.length) {
        const gameId = String.fromCharCode("A".charCodeAt(0) + games.length);
        return error(`게임 ${gameId}의 번호 데이터가 올바르지 않습니다.`);
      }

      const segment = body.slice(cursor + 1, cursor + 13);
      const gameId = String.fromCharCode("A".charCodeAt(0) + games.length);
      const parsed = parseGameSegment(selectionCode, segment, gameId);
      if (!parsed.ok) {
        return parsed;
      }

      games.push(parsed.data);
      cursor += 13;
    }

    if (games.length === 0) {
      return error("게임 번호 데이터가 없습니다.");
    }

    const extraData = body.slice(cursor);

    return ok({
      round: Number(roundText),
      games,
      extraData,
      hasExtraData: Boolean(extraData)
    });
  }

  function parseLottoQr(raw) {
    const value = extractVValue(raw);
    if (!value) {
      return error("QR URL 또는 v 값을 입력해 주세요.");
    }

    const parsed = parseGames(value);
    if (!parsed.ok) {
      return parsed;
    }

    parsed.data.raw = String(raw || "").trim();
    parsed.data.value = value;
    return parsed;
  }

  function collectExcludedNumbers(payload = {}) {
    const parsed = payload.parsed || {};
    const games = parsed.games || [];
    const excluded = new Set();

    if (payload.excludeAllScanned) {
      games.forEach((game) => {
        (game.numbers || []).forEach((number) => excluded.add(number));
      });
    }

    const excludedGameIds = new Set(payload.excludedGameIds || []);
    games.forEach((game) => {
      if (excludedGameIds.has(game.id)) {
        (game.numbers || []).forEach((number) => excluded.add(number));
      }
    });

    (payload.manualExcludedNumbers || []).forEach((number) => {
      const value = Number(number);
      if (Number.isInteger(value) && value >= 1 && value <= 45) {
        excluded.add(value);
      }
    });

    return Array.from(excluded).sort((a, b) => a - b);
  }

  function generateNumbers(payload = {}) {
    const excludedNumbers = collectExcludedNumbers(payload);
    const excluded = new Set(excludedNumbers);
    const candidates = [];

    for (let number = 1; number <= 45; number += 1) {
      if (!excluded.has(number)) {
        candidates.push(number);
      }
    }

    if (candidates.length < 6) {
      return error("제외 조건이 너무 많아 번호를 생성할 수 없습니다.", {
        excludedNumbers,
        availableCount: candidates.length
      });
    }

    const pool = [...candidates];
    const numbers = [];
    for (let index = 0; index < 6; index += 1) {
      const selectedIndex = Math.floor(Math.random() * pool.length);
      numbers.push(pool[selectedIndex]);
      pool.splice(selectedIndex, 1);
    }

    numbers.sort((a, b) => a - b);

    return {
      ok: true,
      numbers,
      excludedNumbers,
      availableCount: candidates.length
    };
  }

  window.Lotto = {
    parseLottoQr,
    generateNumbers,
    collectExcludedNumbers
  };
})();
