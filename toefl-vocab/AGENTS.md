# TOEFL Vocabulary 운영 가이드

## 프로젝트 목적
- 이 저장소의 목적은 TOEFL vocabulary grading, wrong-answer management, spaced review, quiz/report generation을 안정적으로 수행하는 것이다.
- 채점 결과는 간결한 한국어로 요약하되, 원본 데이터는 `data/` 아래의 기계 친화적 파일을 기준으로 관리한다.

## Evidence-backed Grading Contract
- 모든 채점 항목은 다음 machine-readable field를 포함해야 한다: `word`, `user_answer`, `canonical_meaning`, `verdict`, `reason_ko`, `evidence_ko`, `accepted_range_ko`, `correction_ko`, `error_types`, `confidence`.
- `verdict`는 반드시 `correct`, `partial`, `wrong`, `blank` 중 하나다.
- `confidence`는 반드시 `high`, `medium`, `low` 중 하나다.
- `reason_ko`, `evidence_ko`, `accepted_range_ko`, `correction_ko`는 사용자-facing 설명이므로 한국어로 작성한다.
- 모든 판단은 `data/master_words.csv`의 실제 행 또는 실제 세션 파일의 답안에 근거해야 하며 근거를 꾸며내지 않는다.
- 근거가 부족하거나 단어 매칭이 불확실하면 그 사실을 `evidence_ko`에 명시하고 `confidence=low`로 둔다.
- `evidence_ko`에는 사용한 `master_words.csv` 필드명을 구체적으로 적는다. 예: `core_meaning_ko`, `alt_meanings_ko`, `pos`, `example_en`, `example_ko`, `notes`, `accepted_paraphrases_ko`, `grading_notes`, `common_confusions_ko`, `evidence_hint`.

## Core Grading Labels
- `correct`
- `partial`
- `wrong`
- `blank`

## Error Type Taxonomy
- `spelling_only`: 의미는 맞지만 철자, 띄어쓰기, 표기만 어색한 경우
- `blank`: 답을 쓰지 않았거나 실질적으로 비어 있는 경우
- `meaning_confusion`: 다른 단어 의미와 혼동했거나 핵심 의미를 잘못 잡은 경우
- `nuance_mismatch`: 방향은 비슷하지만 강도, 뉘앙스, 문맥이 어긋난 경우
- `polysemy_gap`: 다의어의 다른 뜻은 알지만 현재 기준 의미를 놓친 경우
- `accepted_but_imprecise`: 완전히 틀리지는 않지만 지나치게 넓거나 덜 정확한 경우
- `part_of_speech_mismatch`: 품사에 맞지 않는 뜻으로 답한 경우

## 채점 정책
- 기본 원칙은 `strict but fair`다.
- `exact match`: 답안이 `core_meaning_ko`, `alt_meanings_ko`, 또는 `accepted_paraphrases_ko`의 핵심 의미와 사실상 일치하면 `correct`다.
- `acceptable Korean paraphrase`: 자연스러운 한국어 바꿔쓰기는 허용하되, `accepted_range_ko`에 허용 범위를 설명한다.
- `too broad`: 답이 지나치게 넓어 핵심 의미를 특정하지 못하면 `partial` 또는 `wrong`으로 처리하고 왜 full credit이 아닌지 밝힌다.
- `too narrow`: 답이 한 문맥이나 일부 용례에만 갇히면 `partial`로 처리할 수 있으며 누락된 범위를 설명한다.
- `wrong nuance`: 강도, 방향, 문맥, 평가감이 어긋나면 `nuance_mismatch`를 사용하고 불일치를 설명한다.
- `wrong sense of a polysemous word`: 다의어에서 기준 문맥의 주요 뜻이 아닌 다른 뜻만 답하면 `polysemy_gap`을 사용한다.
- `part-of-speech mismatch`: 품사에 맞지 않는 뜻이나 표현이면 `part_of_speech_mismatch`를 사용한다.
- `spelling-only issue`: 의미는 맞고 철자, 띄어쓰기, 표기만 문제면 `spelling_only`를 의미 정확도와 분리해 기록한다.
- `blank`: 답이 없거나 실질적으로 비어 있으면 `blank`로 처리하고 canonical answer와 짧은 기억 힌트를 제공한다.
- `partial`은 왜 완전 정답이 아닌지 정확히 설명한다.
- `wrong`은 기준 의미와 제출 답안의 불일치를 명확히 설명한다.
- 다의어는 이번 항목의 주 accepted sense를 먼저 말하고, relevant하면 다른 흔한 뜻도 짧게 언급한다.
- 철자 실수는 spelling 문제와 meaning accuracy를 분리해서 설명한다.
- 답이 없으면 `blank`로 처리한다.
- `core_meaning_ko`, `alt_meanings_ko`, `accepted_paraphrases_ko`를 함께 참고하되, 지나친 관대 해석은 피한다.
- `grading_notes`, `common_confusions_ko`, `pos`, `example_en`, `example_ko`, `notes`, `evidence_hint`는 판정의 근거와 confidence 조정에 사용한다.
- 확신이 낮으면 억지로 단정하지 말고 `reason_ko`와 `evidence_ko`에 근거 부족을 남긴다.

## 복습 정책
- 기본 spaced interval은 `1, 3, 7, 14, 30 days`다.
- `wrong` 또는 `blank`이면 간격을 `1 day`로 리셋한다.
- `partial`도 기본적으로 빠른 재복습 대상으로 보고 다음 복습을 가깝게 잡는다.
- 반복 오답이면 `priority`를 올린다.
- confusion pair가 감지되면 `confusion_pairs.csv`를 추가 또는 갱신한다.

## 파일 업데이트 정책
- `data/master_words.csv`는 canonical vocabulary table이다.
- `data/wrong_answers.jsonl`는 append-only history다.
- `data/review_queue.csv`는 현재 기준 next-review state다.
- `reports/` 아래 문서는 generated summary이며 source of truth가 아니다.
- 세션을 채점할 때는 `reports/<session_id>_grading.md`에 상세 Markdown report를 작성한다.
- report에는 session id, grading timestamp, per-word detailed grading blocks, summary statistics, repeated weak spots, suggestions for tomorrow's review를 포함한다.

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
- 기존 history는 파괴적으로 다시 쓰지 않는다.
- 앞으로 append하는 `wrong`, `partial`, `blank` record에는 가능한 경우 `matched_meaning`, `rationale`, `evidence`, `confidence`, `accepted_range`를 포함한다.

## 출력 스타일
- 결과 요약은 간결한 한국어로 작성한다.
- 표나 bullet list는 정말 유용할 때만 사용한다.
- 반복적으로 약한 단어와 약점 유형은 항상 따로 언급한다.
- 데이터가 불충분하면 추정치를 꾸미지 말고 `없음` 또는 짧은 메모로 남긴다.

## 운영 규칙
- 편집 전에는 기존 데이터를 먼저 확인한다.
- 가능한 한 중복 행을 만들지 않는다.
- chronological history는 보존한다.
- `wrong_answers.jsonl`의 과거 기록은 수정하지 말고 필요한 경우 새 줄을 append한다.
- `review_queue.csv`는 단어당 한 행을 유지한다.
- 불확실한 매칭이나 채점은 메모를 남기고 과도한 자신감을 가장하지 않는다.
