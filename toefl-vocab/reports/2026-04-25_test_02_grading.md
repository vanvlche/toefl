# 2026-04-25_test_02 채점 리포트

- 날짜: 2026-04-25
- 채점 시각: 2026-04-25T13:50:35+09:00
- 세션 파일: `sessions/2026-04-25_test_02.txt`
- 채점 대상: 10문항
- 제외: 첫 줄 `2026-04-25_test_02`는 세션 식별자
- 데이터 메모: `inducment`는 `inducement` 오탈자로 정규화
- 요약: `correct 3`, `partial 1`, `wrong 3`, `blank 3`

## Summary

| verdict | count |
| --- | ---: |
| correct | 3 |
| partial | 1 |
| wrong | 3 |
| blank | 3 |

## 주요 약점

- 공란: `cope with`, `disseminate`, `detrimental`
- 의미 혼동: `inducement`를 추측으로, `allegiance`를 아군으로, `markedly`를 인상깊게로 혼동
- 너무 넓은 답: `idiosyncrasy`를 단순히 특징으로 답함
- 정답 안정: `tremendous`, `comprise`, `minute`

## 문항별 채점

| # | word | user answer | verdict | correction_ko |
| ---: | --- | --- | --- | --- |
| 1 | tremendous | 거대한 | correct | 현재 답안을 인정하되, 엄청난/막대한 뉘앙스도 기억 |
| 2 | cope with |  | blank | 대처하다; 감당하다; 잘 처리하다 |
| 3 | inducement | 추측 | wrong | 유인; 동기; 장려책 |
| 4 | comprise | 구성하다 | correct | 현재 답안을 그대로 인정 |
| 5 | allegiance | 아군 | wrong | 충성; 충성심 |
| 6 | idiosyncrasy | 특징 | partial | 특이한 성질; 개인적 특성; 특유의 버릇 |
| 7 | minute | 작은 | correct | 현재 답안을 인정하되, 아주 작은/미세한 뉘앙스도 기억 |
| 8 | markedly | 인상깊게 | wrong | 현저하게; 뚜렷하게; 눈에 띄게 |
| 9 | disseminate |  | blank | 퍼뜨리다; 전파하다; 보급하다 |
| 10 | detrimental |  | blank | 해로운; 손해를 끼치는 |

## 내일 우선 복습

- `cope with`, `disseminate`, `detrimental`: 공란이라 1순위
- `inducement`, `allegiance`, `markedly`: 의미 혼동 교정 필요
- `idiosyncrasy`: `특징`보다 `특이한 성질/특유의 버릇`으로 좁혀 암기

## Machine-Readable Grading Records

```jsonl
{"word":"tremendous","user_answer":"거대한","canonical_meaning":"엄청난; 대단한; 막대한; 매우 큰","verdict":"correct","reason_ko":"'거대한'은 tremendous의 '매우 큰/엄청난' 의미 범위 안에 들어갑니다.","evidence_ko":"master_words.csv의 core_meaning_ko=엄청난, alt_meanings_ko=대단한; 막대한; 매우 큰, accepted_paraphrases_ko=엄청난; 대단한; 막대한; 매우 큰; 거대한을 근거로 판단했습니다.","accepted_range_ko":"엄청난; 대단한; 막대한; 매우 큰; 거대한","correction_ko":"현재 답안을 인정하되, '엄청난/막대한' 뉘앙스도 같이 기억하세요.","error_types":[],"confidence":"high"}
{"word":"cope with","user_answer":"","canonical_meaning":"대처하다; 감당하다; 잘 처리하다","verdict":"blank","reason_ko":"답안이 비어 있어 미응답으로 처리했습니다.","evidence_ko":"master_words.csv의 core_meaning_ko=대처하다, alt_meanings_ko=감당하다; 잘 처리하다, notes=session_import; phrase_entry를 근거로 판단했습니다.","accepted_range_ko":"대처하다; 감당하다; 잘 처리하다; 이겨 내다","correction_ko":"cope with는 '대처하다; 감당하다'로 기억하세요.","error_types":["blank"],"confidence":"high"}
{"word":"inducement","user_answer":"추측","canonical_meaning":"유인; 동기; 장려책; 유도 요인","verdict":"wrong","reason_ko":"세션의 `inducment`는 `inducement` 오탈자로 정규화했습니다. '추측'은 conjecture/guess 의미라 inducement의 '유인/동기'와 다릅니다.","evidence_ko":"master_words.csv의 core_meaning_ko=유인, alt_meanings_ko=동기; 장려책; 유도 요인, notes=normalized_from_session=inducment를 근거로 판단했습니다.","accepted_range_ko":"유인; 동기; 장려책; 유도 요인; 인센티브","correction_ko":"inducement는 '유인; 동기; 장려책'으로 기억하세요.","error_types":["meaning_confusion"],"confidence":"high"}
{"word":"comprise","user_answer":"구성하다","canonical_meaning":"구성하다; 포함하다; ~로 이루어지다","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=구성하다, alt_meanings_ko=포함하다; ~로 이루어지다를 근거로 판단했습니다.","accepted_range_ko":"구성하다; 포함하다; ~로 이루어지다; 이루다","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"allegiance","user_answer":"아군","canonical_meaning":"충성; 충실; 지지; 충성심","verdict":"wrong","reason_ko":"'아군'은 ally/alliance 쪽 의미이고 allegiance의 핵심인 '충성/충성심'과 다릅니다.","evidence_ko":"master_words.csv의 core_meaning_ko=충성, alt_meanings_ko=충실; 지지; 충성심, common_confusions_ko=alliance=동맹; ally=동맹국/아군과 형태 혼동을 근거로 판단했습니다.","accepted_range_ko":"충성; 충성심; 충실; 지지","correction_ko":"allegiance는 '충성; 충성심'으로 기억하세요.","error_types":["meaning_confusion"],"confidence":"high"}
{"word":"idiosyncrasy","user_answer":"특징","canonical_meaning":"특이한 성질; 개인적 특성; 특이성; 특유의 버릇","verdict":"partial","reason_ko":"'특징'은 일부 맞지만 너무 넓습니다. idiosyncrasy는 보통 '특이한 성질/개인 고유의 특성/특유의 버릇'까지 포함해야 합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=특이한 성질, alt_meanings_ko=개인적 특성; 특이성; 특유의 버릇, grading_notes를 근거로 판단했습니다.","accepted_range_ko":"특이한 성질; 개인적 특성; 특이성; 특유의 버릇; 고유한 특징","correction_ko":"idiosyncrasy는 '특이한 성질; 특유의 버릇'으로 기억하세요.","error_types":["accepted_but_imprecise"],"confidence":"high"}
{"word":"minute","user_answer":"작은","canonical_meaning":"아주 작은; 미세한; 세밀한","verdict":"correct","reason_ko":"'작은'은 minute의 핵심 의미에 들어가며 accepted_paraphrases_ko에도 포함됩니다.","evidence_ko":"master_words.csv의 core_meaning_ko=아주 작은, alt_meanings_ko=미세한; 세밀한, accepted_paraphrases_ko=아주 작은; 작은; 미세한; 세밀한을 근거로 판단했습니다.","accepted_range_ko":"아주 작은; 작은; 미세한; 세밀한","correction_ko":"현재 답안을 인정하되, '아주 작은/미세한'까지 같이 기억하세요.","error_types":[],"confidence":"high"}
{"word":"markedly","user_answer":"인상깊게","canonical_meaning":"현저하게; 뚜렷하게; 눈에 띄게","verdict":"wrong","reason_ko":"'인상깊게'는 impressively/memorably에 가깝고, markedly의 '현저하게/뚜렷하게'라는 정도 차이 의미와 다릅니다.","evidence_ko":"master_words.csv의 core_meaning_ko=현저하게, alt_meanings_ko=뚜렷하게; 눈에 띄게, grading_notes를 근거로 판단했습니다.","accepted_range_ko":"현저하게; 뚜렷하게; 눈에 띄게; 상당히","correction_ko":"markedly는 '현저하게; 뚜렷하게; 눈에 띄게'로 기억하세요.","error_types":["meaning_confusion","nuance_mismatch"],"confidence":"high"}
{"word":"disseminate","user_answer":"","canonical_meaning":"퍼뜨리다; 전파하다; 보급하다; 유포하다","verdict":"blank","reason_ko":"답안이 비어 있어 미응답으로 처리했습니다.","evidence_ko":"master_words.csv의 core_meaning_ko=퍼뜨리다, alt_meanings_ko=전파하다; 보급하다; 유포하다를 근거로 판단했습니다.","accepted_range_ko":"퍼뜨리다; 전파하다; 보급하다; 유포하다","correction_ko":"disseminate는 '퍼뜨리다; 전파하다; 보급하다'로 기억하세요.","error_types":["blank"],"confidence":"high"}
{"word":"detrimental","user_answer":"","canonical_meaning":"해로운; 손해를 끼치는; 불리한","verdict":"blank","reason_ko":"답안이 비어 있어 미응답으로 처리했습니다.","evidence_ko":"master_words.csv의 core_meaning_ko=해로운, alt_meanings_ko=손해를 끼치는; 불리한을 근거로 판단했습니다.","accepted_range_ko":"해로운; 손해를 끼치는; 불리한; 유해한","correction_ko":"detrimental은 '해로운; 손해를 끼치는'으로 기억하세요.","error_types":["blank"],"confidence":"high"}
```
