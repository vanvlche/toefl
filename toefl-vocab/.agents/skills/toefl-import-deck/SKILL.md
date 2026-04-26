---
name: toefl-import-deck
description: Use this skill when the user adds or mentions raw TOEFL deck files under decks/ named D{n}_voca, D{n}_voca.txt, D{n}_voca.csv, or D{n}_voca.md and wants them organized into canonical vocabulary data for this repository.
---

# toefl-import-deck 스킬

이 스킬은 `decks/` 아래의 raw deck 파일을 `data/master_words.csv` 중심의 canonical TOEFL vocabulary 데이터로 정리할 때만 사용한다. 채점, 복습 큐 갱신, 세션 채점은 `toefl-review` 스킬의 영역이다.

## 핵심 원칙

- Raw deck 파일은 `decks/`에 그대로 둔다.
- `data/master_words.csv`가 canonical vocabulary table이다.
- Deck membership은 canonical word row의 `deck_ids`, `deck_tags`, `primary_deck_id`, `source_files`에 저장한다.
- 같은 단어가 여러 deck에 나오면 `master_words.csv`의 한 row로 병합한다.
- 한 단어는 여러 deck에 속할 수 있다.
- 기존 `core_meaning_ko`는 함부로 덮어쓰지 않는다.
- 새 deck meaning이 기존 핵심 의미와 충돌하면 기존 핵심 의미를 보존하고, 안전한 경우에만 note 또는 alt meaning 후보로 남긴다.
- 의미가 없거나 불확실한 항목은 뜻을 지어내지 말고 review 대상으로 표시한다.
- AI나 외부 API로 의미를 추론하지 않는다.
- Machine-readable field name은 영어로 유지하고, 사용자 보고와 설명은 한국어로 작성한다.

## 권장 실행 순서

```bash
python3 scripts/import_decks.py --apply
python3 scripts/export_web_seed.py
python3 -m json.tool web/data/seed_words.json > /dev/null
```

## 검증 체크

- `scripts/import_decks.py --dry-run`으로 raw deck parsing 경고를 먼저 확인한다.
- Import 후 `reports/deck_import_report.md`를 읽고 ambiguous line, missing meaning, meaning conflict를 확인한다.
- `web/data/seed_words.json`을 재생성해 `decks`, `deck_ids`, `deck_tags`, `primary_deck_id`, `source_files`가 포함되는지 확인한다.
- 가능한 경우 `node --check web/app.js`와 `node --check web/sw.js`로 JS syntax를 확인한다.
