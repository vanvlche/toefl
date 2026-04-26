# TOEFL Vocab Web/PWA 개발 가이드

## 런타임 데이터 구조

Web/PWA는 실행 중 `web/data/seed_words.json`을 읽어 단어, 복습 상태, 오답 기록을 불러옵니다. 이 파일은 브라우저가 직접 읽는 런타임 데이터 파일이며, 원본 source of truth는 아닙니다.

원본 데이터는 다음 파일입니다.

- `data/master_words.csv`
- `data/review_queue.csv`
- `data/wrong_answers.jsonl`
- `data/confusion_pairs.csv`
- `data/decks.csv`

Raw deck 파일은 최종 source of truth가 아닙니다. Deck import 후에는 `data/master_words.csv`가 canonical 데이터이며, Web UI는 `web/data/seed_words.json`의 `deck_ids`를 읽어 Deck별 화면과 퀴즈를 만듭니다.

## raw deck 파일 추가

새 deck 원본은 `decks/` 아래에 둡니다. 지원하는 파일명 예시는 다음과 같습니다.

- `D1_voca`
- `D1_voca.txt`
- `D2_voca.csv`
- `D3_voca.md`

Raw deck 파일은 그대로 보관하고, import script가 canonical row의 deck tag만 병합합니다. 같은 단어가 여러 deck에 있으면 `data/master_words.csv`의 한 row로 합쳐지고, 한 단어는 여러 deck에 속할 수 있습니다.

## deck tag import

```bash
python3 scripts/import_decks.py --apply
```

Import는 `data/master_words.csv`에 `deck_ids`, `deck_tags`, `primary_deck_id`, `source_files`, `import_notes`를 보강합니다. 의미가 없거나 애매한 줄은 뜻을 지어내지 않고 review 대상으로 보고서에 남깁니다.

## 수동으로 seed 재생성

```bash
python3 scripts/export_web_seed.py
```

이 명령은 원본 데이터를 읽어 `web/data/seed_words.json`을 다시 만듭니다. 출력에는 `schema_version`, `generated_at`, `source_hash`, `source_files`, `decks`, `words`, `confusion_pairs`가 포함됩니다.

## 검증

```bash
python3 -m json.tool web/data/seed_words.json > /dev/null
```

## 자동 업데이트 개발 서버

```bash
python3 scripts/dev_web.py --host 0.0.0.0 --port 8765
```

간단한 정적 서버로 확인할 때는 다음 명령도 사용할 수 있습니다.

```bash
python3 -m http.server 8765 --bind 0.0.0.0
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
- `data/decks.csv`

PWA는 주기적으로, 그리고 화면이 다시 보일 때 업데이트된 seed 데이터를 확인합니다. 새 seed가 감지되면 기존 `localStorage` 진행 상황을 지우지 않고 새 단어와 seed 오답 기록을 병합합니다.

설정 화면의 `단어 데이터 업데이트 확인` 버튼으로 수동 확인도 할 수 있습니다.

## Deck별 학습 UI

Today 화면의 `Deck별 학습` 섹션에서 Deck을 선택할 수 있습니다.

- 선택한 Deck 단어 보기
- 선택한 Deck 퀴즈 시작
- 선택한 Deck 가중치 퀴즈

Deck UI가 보이지 않으면 먼저 `python3 scripts/import_decks.py --apply` 후 `python3 scripts/export_web_seed.py`를 실행했는지 확인합니다.

## Adaptive Scheduler v2

Web/PWA에는 Adaptive Scheduler v2 MVP가 포함되어 있습니다. 이 스케줄러는 로컬 브라우저 안에서 동작하는 가벼운 FSRS-lite 방식이며, 전체 FSRS 구현은 아닙니다.

각 단어의 복습 상태에는 `stability_days`, `difficulty`, `retrievability`, `lapses`, `learning_phase`, `desired_retention` 같은 메모리 지표가 추가됩니다. 기존 `localStorage` 진행 상황은 삭제하지 않고, 앱 로딩 시 빠진 필드만 안전하게 보강합니다.

정답을 맞히면 결과 화면에서 이번 회상 난이도를 고릅니다.

- 쉬웠음
- 보통
- 어려웠음

오답이나 미응답은 재학습 상태로 기록되고 오늘 다시 복습 대상으로 잡힙니다. 부분 정답은 짧은 복습 간격으로 남습니다.

설정 화면의 `복습 스케줄` 섹션에서 목표 기억률을 바꿀 수 있습니다.

- 85%
- 90%
- 95%

목표 기억률을 높이면 다음 복습 간격이 짧아지고 복습량이 늘어납니다. 설정 변경은 기존 카드 전체를 즉시 재스케줄하지 않고, 다음 채점부터 새 스케줄 계산에 반영됩니다.

패치 후 UI가 예전 상태로 보이면 hard reload를 실행하거나 service worker를 unregister하고 Cache Storage를 삭제합니다. 진행 상황을 보존해야 하므로 `localStorage`는 진행 상황을 내보내기 전에는 지우지 마세요.

## PWA 캐시 처리

앱 shell 파일은 오프라인 사용을 위해 계속 캐시됩니다.

`web/data/seed_words.json`은 stale vocabulary data를 피하기 위해 network-first로 처리됩니다. 네트워크가 가능하면 최신 파일을 받고 캐시를 갱신하며, 오프라인이면 마지막으로 캐시된 seed를 사용합니다.

개발 서버는 `/web/data/*` 응답에 `no-store` 캐시 헤더를 보냅니다.

## 아직 예전 데이터가 보일 때

먼저 페이지를 새로고침합니다.

설치형 PWA라면 앱을 완전히 닫았다가 다시 엽니다.

그래도 Deck UI가 나타나지 않으면 브라우저 개발자 도구에서 service worker를 unregister하거나 hard reload를 실행합니다.

그래도 오래된 데이터가 보이면 설정 화면에서 진행 상황을 먼저 내보낸 뒤, 마지막 수단으로 브라우저의 site data를 지웁니다. Site data를 지우면 `localStorage`에 저장된 진행 상황도 삭제됩니다.
