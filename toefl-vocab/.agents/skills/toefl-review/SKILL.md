---
name: toefl-review
description: Use this skill when the user wants to grade a TOEFL vocabulary test, update wrong-answer history, refresh the review queue, generate today's quiz, or produce weekly review reports for this repository.
---

# toefl-review 스킬

이 스킬은 이 저장소의 TOEFL 어휘 채점과 복습 파일 갱신 작업에만 사용한다. 다른 프로젝트나 다른 데이터 형식에는 확장하지 않는다.

## 대상 파일
- 세션 입력: `toefl-vocab/sessions/*.txt`
- 기준 사전: `toefl-vocab/data/master_words.csv`
- 오답 이력: `toefl-vocab/data/wrong_answers.jsonl`
- 복습 큐: `toefl-vocab/data/review_queue.csv`
- 혼동 쌍: `toefl-vocab/data/confusion_pairs.csv`
- 보고서: `toefl-vocab/reports/today_quiz.md`, `toefl-vocab/reports/weekly_report.md`
- 세션별 상세 채점 보고서: `toefl-vocab/reports/<session_id>_grading.md`

## wrong_answers.jsonl 스키마
```json
{
  "timestamp": "...",
  "session_id": "...",
  "word": "...",
  "user_answer": "...",
  "gold_meaning": "...",
  "verdict": "correct|partial|wrong|blank",
  "error_types": ["..."],
  "notes": "...",
  "matched_meaning": "...",
  "rationale": "...",
  "evidence": "...",
  "confidence": "high|medium|low",
  "accepted_range": "...",
  "source_file": "..."
}
```
- 기존 history는 append-only로 보존한다.
- 앞으로 추가하는 `wrong`, `partial`, `blank` record에는 가능한 경우 `matched_meaning`, `rationale`, `evidence`, `confidence`, `accepted_range`를 함께 기록한다.

## 실행 원칙
- 항상 기존 파일을 먼저 읽고 업데이트한다.
- `wrong_answers.jsonl`은 append-only로 유지한다.
- `review_queue.csv`는 단어당 한 행만 유지한다.
- 근거가 약하면 과장하지 말고 `notes`에 불확실성을 남긴다.
- 출력과 보고서는 한국어 중심으로 작성한다.
- machine-readable field name은 영어로 유지한다.
- 모든 채점 설명은 `data/master_words.csv`의 실제 필드 또는 실제 세션 답안에 근거해야 한다.
- 근거가 부족하면 `confidence=low`로 두고 `근거 부족`을 명시한다.

## 1. 세션 파일 읽기
- `sessions/`에서 사용자가 지정한 파일 하나를 읽는다.
- 첫 줄이 `토플 단어 시험 결과 채점 :`이면 헤더로 보고 제외한다.
- 나머지 줄은 앞의 첫 토큰을 `word`, 나머지 전체를 `user_answer`로 본다.
- 줄에 단어만 있고 답이 없으면 `user_answer`는 빈 문자열로 처리한다.
- 빈 줄은 문제 항목으로 세지 않는다.
- `session_id`는 세션 파일명에서 확장자를 뺀 값으로 둔다.

## 2. 단어 정규화
- `word`는 trim 후 소문자로 정규화한다.
- 먼저 `master_words.csv`의 `word`와 exact lowercase match를 시도한다.
- exact match가 없고, 한 글자 차이의 오탈자 후보가 정확히 하나뿐이면 그 단어로 정규화하고 `notes`에 `word_normalized_from_session`를 남긴다.
- 후보가 여러 개이거나 불명확하면 억지 매칭하지 말고 검토 메모를 남긴 뒤 수동 확인 대상으로 둔다.

## 3. 상세 채점 알고리즘
각 항목은 아래 순서로 채점한다.

1. 세션 파일에서 `word`와 `user_answer`를 확정한다.
2. `data/master_words.csv`에서 해당 `word` 행을 찾는다.
3. `core_meaning_ko`를 기준 의미로 삼고, `alt_meanings_ko`와 `accepted_paraphrases_ko`를 허용 답안 범위로 함께 본다.
4. `grading_notes`, `common_confusions_ko`, `pos`, `notes`, `example_en`, `example_ko`, `evidence_hint`를 관련 있을 때 판정 근거로 사용한다.
5. 가장 잘 맞는 canonical meaning 또는 sense를 `matched_meaning`으로 정한다.
6. 제출 답안과 `core_meaning_ko`, `alt_meanings_ko`, `accepted_paraphrases_ko`를 비교한다.
7. `correct`, `partial`, `wrong`, `blank` 중 verdict 하나를 부여한다.
8. `error_types`를 하나 이상 부여한다. `correct`는 의미 오류가 없으면 `[]`로 둘 수 있다.
9. 한국어 `reason_ko`를 작성해 왜 accepted, partially accepted, rejected인지 설명한다.
10. 한국어 `evidence_ko`를 작성하되 사용한 source field name을 명시한다.
11. `accepted_range_ko`에 full credit으로 인정 가능한 답안 범위를 쓴다.
12. `correction_ko`에 이번 답안을 어떻게 고치면 되는지 쓴다.
13. `confidence`를 `high`, `medium`, `low` 중 하나로 둔다.

## 4. verdict 정책
- `correct`: exact match이거나 허용 가능한 한국어 paraphrase이며 핵심 의미 손실이 거의 없다.
- `partial`: 방향은 맞지만 too broad, too narrow, wrong nuance, part-of-speech mismatch, 또는 polysemy gap 때문에 full credit이 아니다.
- `wrong`: 핵심 의미가 어긋났거나 다른 단어 뜻으로 답했다.
- `blank`: 답이 비어 있거나 실질적인 의미 답안이 없다.
- `partial`은 왜 완전 정답이 아닌지 반드시 설명한다.
- `wrong`은 기준 의미와 제출 답안 사이의 mismatch를 명확히 설명한다.
- 다의어는 이번 항목에서 주로 받아들일 sense를 먼저 쓰고, 관련 있으면 다른 흔한 sense를 덧붙인다.
- 철자 문제는 의미 정확도와 분리한다. 의미가 맞고 표기만 문제면 `spelling_only`를 사용한다.
- blank 답안에는 canonical answer와 짧은 memory hint를 `correction_ko`에 포함한다.

## 5. error_types taxonomy
- `spelling_only`: 의미는 맞지만 철자, 띄어쓰기, 표기만 어색한 경우
- `blank`: 답을 쓰지 않았거나 실질적으로 비어 있는 경우
- `meaning_confusion`: 다른 단어 의미와 혼동했거나 핵심 의미를 잘못 잡은 경우
- `nuance_mismatch`: 방향은 비슷하지만 강도, 뉘앙스, 문맥이 어긋난 경우
- `polysemy_gap`: 다의어의 다른 뜻은 알지만 현재 기준 의미를 놓친 경우
- `accepted_but_imprecise`: 완전히 틀리지는 않지만 지나치게 넓거나 덜 정확한 경우
- `part_of_speech_mismatch`: 품사에 맞지 않는 뜻으로 답한 경우

## 6. 항목별 출력 형식
각 단어는 아래 Markdown block을 사용한다.

```markdown
### {word}
- 제출 답안:
- 기준 의미:
- 판정:
- 판정 이유:
- 근거:
- 허용 가능한 답 범위:
- 교정 답안:
- 오류 유형:
- 신뢰도:
```

## 7. 세션 요약 형식
세션 끝에는 아래 항목을 모두 포함한다.

- 총 문항 수
- 완전 정답 수
- 부분정답 수
- 오답 수
- 미응답 수
- 반복 취약 유형 Top N
- 내일 복습할 단어
- master_words 보강이 필요한 단어

## 8. 세션별 상세 보고서 작성
- 세션을 채점하면 `reports/<session_id>_grading.md`를 작성한다.
- `<session_id>`는 세션 파일명에서 확장자를 뺀 값이다.
- 보고서 제목은 `# <session_id> 상세 채점 보고서`로 쓴다.
- 보고서에는 `session id`, `grading timestamp`, 항목별 상세 채점 block, summary statistics, repeated weak spots, suggestions for tomorrow's review를 포함한다.
- `grading timestamp`는 로컬 현재 시각의 ISO 8601 문자열을 사용한다.
- repeated weak spots는 이번 세션의 `error_types`와 기존 `wrong_answers.jsonl` 반복 기록을 함께 고려한다.
- suggestions for tomorrow's review는 `blank`, `wrong`, `partial`, 반복 취약 유형을 기준으로 작성한다.
- 보고서를 쓸 수 없으면 이유를 사용자에게 밝히고 다른 데이터 파일 갱신 여부를 분리해 설명한다.

## 9. wrong_answers.jsonl append 규칙
- `wrong`, `partial`, `blank`만 JSONL에 추가한다.
- 각 줄은 단일 JSON object로 기록한다.
- `timestamp`는 로컬 현재 시각의 ISO 8601 문자열을 사용한다.
- `session_id`는 세션 파일명에서 확장자를 뺀 값이다.
- `gold_meaning`은 `core_meaning_ko`를 기본으로 쓰고 필요한 경우 `alt_meanings_ko` 핵심 부분을 짧게 덧붙인다.
- `matched_meaning`은 상세 채점에서 선택한 기준 의미 또는 sense를 기록한다.
- `rationale`은 `reason_ko`와 같은 내용을 짧게 기록한다.
- `evidence`는 `evidence_ko`와 같이 실제 사용한 source field name을 포함한다.
- `confidence`는 `high`, `medium`, `low` 중 하나를 기록한다.
- `accepted_range`는 full credit으로 인정 가능한 한국어 답안 범위를 기록한다.
- `source_file`에는 세션 파일의 상대 경로를 기록한다.

## 10. review_queue.csv 갱신 규칙
- 해당 단어 행이 없으면 기본값으로 새로 만든다.
- 기본값은 `interval_days=1`, `ease=2.50`, `consecutive_correct=0`, `total_wrong=0`, `priority=1`이다.
- 처리 시 `last_seen`은 채점 실행 날짜, `last_verdict`는 이번 verdict로 갱신한다.
- `correct`면 `consecutive_correct`를 1 올리고 다음 간격은 `1, 3, 7, 14, 30` 순서로 올리며 30일에서 cap 한다.
- `partial`이면 `consecutive_correct=0`, `interval_days=1`, `total_wrong += 1`, `priority += 1`로 처리한다.
- `wrong` 또는 `blank`면 `consecutive_correct=0`, `interval_days=1`, `total_wrong += 1`로 처리한다.
- 이미 `total_wrong`가 있던 단어가 다시 `wrong` 또는 `blank`가 되면 `priority`를 추가로 올려 반복 약점으로 표시한다.
- `next_review_date`는 실행 날짜에 `interval_days`를 더해 계산한다.

## 11. confusion_pairs.csv 갱신 규칙
- 사용자의 답이 다른 기준 단어의 뜻과 명확히 대응하면 confusion pair 후보로 본다.
- 같은 쌍이 `wrong_answers.jsonl`에서 두 번 이상 반복되면 `confusion_pairs.csv`를 upsert 한다.
- `word_a`는 정답 단어, `word_b`는 혼동한 단어로 유지한다.
- `reason`은 짧은 한국어로 적고, `count`와 `last_seen`을 갱신한다.
- `example_hint`에는 두 단어의 차이를 한 줄로 남긴다.

## 12. reports/today_quiz.md 생성 규칙
- `next_review_date <= 오늘`인 단어를 복습 대상으로 잡는다.
- 정렬 순서는 `priority` 내림차순, `total_wrong` 내림차순, `word` 오름차순이다.
- 기본 10개까지 뽑고, 부족하면 due 단어만 기록한다.
- 문제에는 영어 단어를, 정답에는 한국어 핵심 뜻을 적는다.
- `채점 메모`에는 반복 약점과 confusion pair를 짧게 적는다.

## 13. reports/weekly_report.md 생성 규칙
- 최근 7일의 `wrong_answers.jsonl`을 집계한다.
- `이번 주 요약`, `총 복습 단어 수`, `신규 오답`, `반복 오답 Top 10`, `confusion pairs`, `다음 주 집중 단어`, `메모` 섹션을 모두 채운다.
- 반복 오답은 단어 기준 빈도 내림차순으로 정리한다.
- 다음 주 집중 단어는 높은 `priority`, 잦은 오답, 임박한 복습일을 함께 고려한다.
- 데이터가 부족하면 `없음`이라고 쓰고 추측으로 채우지 않는다.
