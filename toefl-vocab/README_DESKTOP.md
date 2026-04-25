# TOEFL Vocab Windows 데스크톱 앱

## 추가된 내용

기존 `web/` PWA를 그대로 불러오는 Electron 데스크톱 래퍼를 추가했습니다.

- `desktop/electron/main.cjs`: Electron 메인 프로세스, 창 생성, 앱 메뉴, 파일 저장/열기 대화상자
- `desktop/electron/preload.cjs`: renderer에 안전한 `window.toeflDesktop` API 노출
- `package.json`: Electron 실행 및 빌드 스크립트, electron-builder 설정
- `web/app.js`: Electron seed 로딩 fallback, 진행 상황 내보내기/가져오기/초기화 함수, 메뉴 이벤트 연결
- `web/style.css`: 큰 화면에서도 모바일 앱 폭을 유지하는 데스크톱 스타일

## 기존 PWA와의 관계

데스크톱 앱은 새 UI를 다시 만든 것이 아니라 기존 `web/index.html`, `web/app.js`, `web/style.css`, `web/data/seed_words.json`을 로컬 파일로 실행합니다. 브라우저/PWA 모드에서는 기존처럼 `fetch("./data/seed_words.json")`로 seed를 읽고, Electron의 `file://` 환경에서 fetch가 실패하면 preload API로 같은 seed JSON을 읽습니다.

진행 상황은 현재와 동일하게 localStorage에 저장됩니다. 데스크톱 메뉴와 설정 화면에서 JSON 백업 파일로 내보내기/가져오기를 할 수 있습니다.

## Windows PowerShell에서 실행

```powershell
npm install
npm run desktop:dev
```

## Windows 빌드

```powershell
npm run desktop:build
```

개발용 패키지만 만들려면 다음 명령을 사용할 수 있습니다.

```powershell
npm run desktop:pack
```

## 빌드 결과 위치

electron-builder의 기본 출력 폴더인 `dist/` 아래에 결과물이 생성됩니다. Windows 빌드 설정은 `nsis` 설치 파일과 `portable` 실행 파일을 대상으로 합니다.

## 네트워크가 필요한 부분

`npm install`은 `electron`과 `electron-builder`를 내려받아야 하므로 네트워크가 필요합니다. Electron 바이너리나 electron-builder 캐시가 로컬에 없으면 `npm run desktop:dev`, `npm run desktop:build`도 의존성 설치가 먼저 필요합니다.

앱 실행 후 학습 데이터와 진행 상황 저장은 로컬 파일 및 localStorage를 사용하므로 설치 후에는 오프라인으로 동작하도록 구성했습니다.

## 확인한 내용

- `package.json` JSON 문법 확인
- `web/data/seed_words.json` JSON 문법 확인
- `desktop/electron/main.cjs`, `desktop/electron/preload.cjs`, `web/app.js` JavaScript 문법 확인
- Electron 설정에서 참조하는 주요 파일 존재 확인

## 아직 확인하지 못한 내용

이 작업 환경에는 npm 의존성이 설치되어 있지 않아 Electron 앱 실행과 Windows installer 빌드는 실제로 실행하지 않았습니다. Windows에서 `npm install` 후 `npm run desktop:dev`, `npm run desktop:build`를 실행해 최종 확인해야 합니다.
