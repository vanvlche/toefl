# 주간 복습 리포트

## 이번 주 요약
- 기간: 2026-04-18 ~ 2026-04-24
- 요약: `2026-04-23_test_01` 채점 결과 19개 중 `correct 11`, `partial 3`, `wrong 3`, `blank 2`였다. 다의어/뉘앙스 구분과 공란 응답이 주요 약점으로 보인다.

## 총 복습 단어 수
- count: 19

## 신규 오답
| word | verdict | error_types | note |
| --- | --- | --- | --- |
| barely | partial | nuance_mismatch, accepted_but_imprecise | 거의 ~않다 방향은 맞지만 간신히 뉘앙스가 약함 |
| striking | wrong | nuance_mismatch | 두드러진 대신 극심한으로 답함 |
| exude | partial | accepted_but_imprecise | 냄새로만 한정해 의미 범위가 좁음 |
| rudiments | partial | accepted_but_imprecise | 기초 의미는 맞지만 답이 넓음 |
| constrain | wrong | meaning_confusion | 제약하다 대신 강요하다로 답함 |
| eclectic | wrong | meaning_confusion | 기준 의미와 연결되지 않는 오답 |
| intricate | blank | blank | 무응답 |
| peril | blank | blank | 무응답 |

## 반복 오답 Top 10
| rank | word | total | 최근 메모 |
| --- | --- | --- | --- |
| 1 | 없음 | 0 | 아직 2회 이상 반복된 오답은 없음 |

## confusion pairs
| word_a | word_b | reason | count |
| --- | --- | --- | --- |
| 없음 | 없음 | 이번 실행에서 확정된 confusion pair 없음 | 0 |

## 다음 주 집중 단어
- barely
- striking
- exude
- rudiments
- constrain
- eclectic
- intricate
- peril

## 메모
- `unwieldly`는 세션 오탈자로 보고 `unwieldy`로 정규화해 채점했다.
- `set`, `article`, `subject`는 다의어 허용 범위 안에서 정답 처리했다.
- 실제 기준 데이터는 `data/master_words.csv`, `data/wrong_answers.jsonl`, `data/review_queue.csv`다.
