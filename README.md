# Lotto QR Analyzer

GitHub Pages에서 동작하는 모바일 로또 QR 분석기입니다.

## 기능

- QR URL의 `v` 값을 분석해 회차와 게임별 번호 표시
- `q` 자동, `m` 수동 선택 유형 표시
- 실제 복권 QR 뒤에 붙는 판매점/부가 정보 보존
- iPhone/Android 사진 촬영 또는 이미지 선택 QR 인식
- iPhone/Android 실시간 카메라 QR 인식
- QR URL 직접 입력 fallback
- 스캔된 전체 번호 제외
- 특정 게임 번호 제외
- 1~45 중 직접 선택한 번호 제외
- 제외 조건을 반영한 랜덤 번호 6개 생성

## QR 입력 방식

모바일 호환성을 위해 다음 순서로 사용할 수 있습니다.

1. 사진 찍기 또는 이미지 선택 후 QR 인식
2. 실시간 카메라 프리뷰 QR 인식
3. QR URL 직접 입력
4. iPhone 기본 카메라 앱으로 QR URL 열기

iPhone에서는 사진으로 인식하는 방식이 가장 안정적입니다. 실시간 인식은 `getUserMedia()`로 받은 카메라 프레임을 `canvas`에 그린 뒤 `jsQR`로 분석합니다.

## 샘플

```text
https://m.dhlottery.co.kr/?v=0955q010715172842q030712163541q202730353941q031328364445q021214192934
```

기대 결과:

- 955회
- A 자동 01 07 15 17 28 42
- B 자동 03 07 12 16 35 41
- C 자동 20 27 30 35 39 41
- D 자동 03 13 28 36 44 45
- E 자동 02 12 14 19 29 34

실제 복권 QR은 마지막 게임 이후에 판매점 또는 발권 관련 부가 숫자가 붙을 수 있습니다. 앱은 최대 5게임을 먼저 파싱하고 남은 값은 부가 정보로 보관합니다.

## 로컬 실행

정적 파일이지만 QR 이미지 인식 파일을 로드하므로 로컬 서버로 실행합니다.

```powershell
python -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다.

## Vendoring

외부 CDN 장애와 무관하게 동작하도록 QR 인식 런타임을 저장소에 포함합니다.

- jsQR: `vendor/jsqr/jsQR.js`

앱은 CDN을 사용하지 않고 로컬 정적 파일을 로드합니다.

## App icon

모바일 홈 화면 바로가기용 아이콘은 후보 1을 기준으로 적용했습니다.

- 원본 투명 PNG: `assets/icons/app-icon-source.png`
- iOS 홈 화면: `assets/icons/apple-touch-icon.png`
- Web app manifest: `assets/icons/icon-192.png`, `assets/icons/icon-512.png`
- Favicon: `assets/icons/favicon-16.png`, `assets/icons/favicon-32.png`
