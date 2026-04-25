# TOEFL Vocab Web/PWA 개발 가이드

## 런타임 데이터 구조

Web/PWA는 실행 중 `web/data/seed_words.json`을 읽어 단어, 복습 상태, 오답 기록을 불러옵니다. 이 파일은 브라우저가 직접 읽는 런타임 데이터 파일이며, 원본 source of truth는 아닙니다.

원본 데이터는 다음 파일입니다.

- `data/master_words.csv`
- `data/review_queue.csv`
- `data/wrong_answers.jsonl`
- `data/confusion_pairs.csv`

## 수동으로 seed 재생성

```bash
python3 scripts/export_web_seed.py
```

이 명령은 원본 데이터를 읽어 `web/data/seed_words.json`을 다시 만듭니다. 출력에는 `schema_version`, `generated_at`, `source_hash`, `source_files`, `words`, `confusion_pairs`가 포함됩니다.

## 자동 업데이트 개발 서버

```bash
python3 scripts/dev_web.py --host 0.0.0.0 --port 8765
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:8765/web/
```

같은 네트워크의 다른 기기에서는 `localhost` 대신 이 컴퓨터의 LAN IP를 사용합니다.

## 자동 업데이트의 의미

`scripts/dev_web.py`가 실행 중이면 다음 원본 파일 변경을 감지해 `web/data/seed_words.json`을 재생성합니다.

- `data/master_words.csv`
- `data/review_queue.csv`
- `data/wrong_answers.jsonl`
- `data/confusion_pairs.csv`

PWA는 주기적으로, 그리고 화면이 다시 보일 때 업데이트된 seed 데이터를 확인합니다. 새 seed가 감지되면 기존 `localStorage` 진행 상황을 지우지 않고 새 단어와 seed 오답 기록을 병합합니다.

설정 화면의 `단어 데이터 업데이트 확인` 버튼으로 수동 확인도 할 수 있습니다.

## raw deck 파일 주의

`decks/*.txt` 변경은 watcher가 감지해 export를 다시 실행하는 트리거로만 사용됩니다.

Raw deck 파일은 기존 import workflow가 `data/master_words.csv`에 canonical 단어 행을 추가해야 PWA에 나타납니다. 임의의 deck 텍스트를 Web/PWA exporter가 직접 파싱한다고 가정하지 않습니다.

## PWA 캐시 처리

앱 shell 파일은 오프라인 사용을 위해 계속 캐시됩니다.

`web/data/seed_words.json`은 stale vocabulary data를 피하기 위해 network-first로 처리됩니다. 네트워크가 가능하면 최신 파일을 받고 캐시를 갱신하며, 오프라인이면 마지막으로 캐시된 seed를 사용합니다.

개발 서버는 `/web/data/*` 응답에 `no-store` 캐시 헤더를 보냅니다.

## 아직 예전 데이터가 보일 때

먼저 페이지를 새로고침합니다.

설치형 PWA라면 앱을 완전히 닫았다가 다시 엽니다.

그래도 오래된 데이터가 보이면 설정 화면에서 진행 상황을 먼저 내보낸 뒤, 마지막 수단으로 브라우저의 site data를 지웁니다. Site data를 지우면 `localStorage`에 저장된 진행 상황도 삭제됩니다.
