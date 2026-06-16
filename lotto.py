import json
import random
import re
from urllib.parse import parse_qs, unquote, urlparse


SELECTION_LABELS = {
    "q": "auto",
    "m": "manual",
}


def _ok(data):
    return {"ok": True, "data": data}


def _error(message, **extra):
    result = {"ok": False, "error": message}
    result.update(extra)
    return result


def selection_label(selection_code):
    return SELECTION_LABELS.get(selection_code)


def extract_v_value(raw):
    if raw is None:
        return ""

    text = str(raw).strip()
    if not text:
        return ""

    parsed = urlparse(text)
    query = parsed.query

    if query:
        values = parse_qs(query).get("v")
        if values:
            return unquote(values[0]).strip()

    if text.startswith("?"):
        values = parse_qs(text[1:]).get("v")
        if values:
            return unquote(values[0]).strip()

    if text.startswith("v="):
        values = parse_qs(text).get("v")
        if values:
            return unquote(values[0]).strip()

    match = re.search(r"(?:[?&]v=)([^&#]+)", text)
    if match:
        return unquote(match.group(1)).strip()

    return text


def validate_game(numbers, game_id):
    if len(numbers) != 6:
        return "게임 %s의 번호는 6개여야 합니다." % game_id

    if len(set(numbers)) != 6:
        return "게임 %s에 중복 번호가 있습니다." % game_id

    for number in numbers:
        if number < 1 or number > 45:
            return "게임 %s의 번호 %02d는 1~45 범위를 벗어났습니다." % (game_id, number)

    return None


def parse_game_segment(selection_code, segment, game_id):
    label = selection_label(selection_code)
    if label is None:
        return _error("게임 %s의 선택 유형을 알 수 없습니다." % game_id)

    if not re.fullmatch(r"\d{12}", segment or ""):
        return _error("게임 %s의 번호 데이터가 올바르지 않습니다." % game_id)

    numbers = [int(segment[index:index + 2]) for index in range(0, 12, 2)]
    validation_error = validate_game(numbers, game_id)
    if validation_error:
        return _error(validation_error)

    return _ok({
        "id": game_id,
        "selectionType": label,
        "selectionCode": selection_code,
        "numbers": numbers,
    })


def parse_games(value):
    if len(value) < 17:
        return _error("QR 번호 데이터가 부족합니다.")

    round_text = value[:4]
    if not re.fullmatch(r"\d{4}", round_text):
        return _error("회차 정보가 올바르지 않습니다.")

    body = value[4:]
    if not body:
        return _error("게임 번호 데이터가 없습니다.")

    games = []
    cursor = 0
    game_index = 0

    while cursor < len(body):
        selection_code = body[cursor:cursor + 1]
        if selection_code not in SELECTION_LABELS:
            return _error("지원하지 않는 선택 유형 '%s'가 포함되어 있습니다." % selection_code)

        segment = body[cursor + 1:cursor + 13]
        game_id = chr(ord("A") + game_index)
        parsed = parse_game_segment(selection_code, segment, game_id)
        if not parsed["ok"]:
            return parsed

        games.append(parsed["data"])
        cursor += 13
        game_index += 1

    if not games:
        return _error("게임 번호 데이터가 없습니다.")

    return _ok({
        "round": int(round_text),
        "games": games,
    })


def parse_lotto_qr(raw):
    value = extract_v_value(raw)
    if not value:
        return _error("QR URL 또는 v 값을 입력해 주세요.")

    parsed = parse_games(value)
    if not parsed["ok"]:
        return parsed

    parsed["data"]["raw"] = str(raw).strip()
    parsed["data"]["value"] = value
    return parsed


def collect_excluded_numbers(payload):
    parsed = payload.get("parsed") or {}
    games = parsed.get("games") or []
    excluded = set()

    if payload.get("excludeAllScanned"):
        for game in games:
            excluded.update(game.get("numbers") or [])

    excluded_game_ids = set(payload.get("excludedGameIds") or [])
    for game in games:
        if game.get("id") in excluded_game_ids:
            excluded.update(game.get("numbers") or [])

    for number in payload.get("manualExcludedNumbers") or []:
        try:
            value = int(number)
        except (TypeError, ValueError):
            continue
        if 1 <= value <= 45:
            excluded.add(value)

    return sorted(excluded)


def generate_numbers(payload):
    excluded_numbers = collect_excluded_numbers(payload or {})
    excluded = set(excluded_numbers)
    candidates = [number for number in range(1, 46) if number not in excluded]

    if len(candidates) < 6:
        return _error(
            "제외 조건이 너무 많아 번호를 생성할 수 없습니다.",
            excludedNumbers=excluded_numbers,
            availableCount=len(candidates),
        )

    numbers = sorted(random.sample(candidates, 6))
    return {
        "ok": True,
        "numbers": numbers,
        "excludedNumbers": excluded_numbers,
        "availableCount": len(candidates),
    }


def parse_lotto_qr_json(raw):
    return json.dumps(parse_lotto_qr(raw), ensure_ascii=False)


def generate_numbers_json(payload_json):
    try:
        payload = json.loads(payload_json or "{}")
    except ValueError:
        return json.dumps(_error("생성 조건 데이터가 올바르지 않습니다."), ensure_ascii=False)

    return json.dumps(generate_numbers(payload), ensure_ascii=False)
