# Lotto QR Analyzer

GitHub Pages에서 동작하는 모바일 로또 QR 분석기입니다.

## 기능

- QR URL의 `v` 값을 분석해 회차와 게임별 번호 표시
- `q` 자동, `m` 수동 선택 유형 표시
- 스캔된 전체 번호 제외
- 특정 게임 번호 제외
- 1~45 중 직접 선택한 번호 제외
- 제외 조건을 반영한 랜덤 번호 6개 생성

## 샘플

```text
http://m.dhlottery.co.kr/?v=0955q010715172842q030712163541q202730353941q031328364445q021214192934
```

기대 결과:

- 955회
- A 자동 01 07 15 17 28 42
- B 자동 03 07 12 16 35 41
- C 자동 20 27 30 35 39 41
- D 자동 03 13 28 36 44 45
- E 자동 02 12 14 19 29 34

## 로컬 실행

정적 파일이지만 로컬 Pyodide 파일과 `lotto.py` fetch를 사용하므로 로컬 서버로 실행합니다.

```powershell
python -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다.

## Pyodide vendoring

Pyodide 런타임은 `vendor/pyodide/`에 정적 파일로 포함되어 있습니다. 앱은 CDN을 사용하지 않고 `./vendor/pyodide/pyodide.js`와 같은 로컬 파일을 로드합니다.
