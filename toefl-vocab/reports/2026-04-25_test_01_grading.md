# 2026-04-25_test_01 채점 리포트

- 날짜: 2026-04-25
- 채점 시각: 2026-04-25T11:32:22+09:00
- 세션 파일: `sessions/2026-04-25_test_01.txt`
- 채점 대상: 30문항
- 제외: 첫 줄 `2026-04-25_test_01`는 세션 식별자
- 요약: `correct 20`, `partial 7`, `wrong 0`, `blank 3`

## Summary

| verdict | count |
| --- | ---: |
| correct | 20 |
| partial | 7 |
| wrong | 0 |
| blank | 3 |

## 주요 약점

- 공란 반복: `peril`, `arduous`, `insolent`
- 의미는 떠올렸지만 뉘앙스가 약함: `palatial`, `intricate`, `eclectic`, `turmoil`, `crude`, `materialize`, `profuse`
- 전날 대비 회복: `recompense`, `deem`, `demolish`, `constituent`

## 문항별 채점

| # | word | user answer | verdict | correction_ko |
| ---: | --- | --- | --- | --- |
| 1 | palatial | 궁정의 | partial | 궁전 같은; 매우 호화로운 |
| 2 | potent | 강력한 | correct | 현재 답안을 그대로 인정 |
| 3 | intricate | 복잡한 | partial | 복잡하게 얽힌; 정교한 |
| 4 | eclectic | 다방면의 | partial | 절충적인; 여러 요소를 골라 취한 |
| 5 | turmoil | 소란 | partial | 혼란; 소동; 격변 |
| 6 | preeminent | 최상의 | correct | 현재 답안을 그대로 인정 |
| 7 | recompense | 보상하다 | correct | 현재 답안을 그대로 인정 |
| 8 | crude | 단순하다 | partial | 조잡한; 대략의; 가공되지 않은 |
| 9 | proliferate | 증식하다 | correct | 현재 답안을 그대로 인정 |
| 10 | assess | 평가하다 | correct | 현재 답안을 그대로 인정 |
| 11 | scrutiny | 정밀조사 | correct | 현재 답안을 그대로 인정 |
| 12 | acute | 극심한 | correct | 현재 답안을 그대로 인정 |
| 13 | inadvertently | 우연히 | correct | 현재 답안을 그대로 인정하되, 무심코/부주의하게 뉘앙스도 기억 |
| 14 | peril |  | blank | 위험; 위험한 상황 |
| 15 | arduous |  | blank | 고된; 힘든 |
| 16 | materialize | 구현화하다 | partial | 실현되다; 나타나다; 구체화되다 |
| 17 | demise | 죽음 | correct | 현재 답안을 그대로 인정 |
| 18 | deem | 간주하다 | correct | 현재 답안을 그대로 인정 |
| 19 | profuse | 많은 | partial | 풍부한; 과도한; 많이 흘리는 |
| 20 | ornament | 장식품 | correct | 현재 답안을 그대로 인정 |
| 21 | demolish | 철거하다 | correct | 현재 답안을 그대로 인정 |
| 22 | voracious | 게걸스러운 | correct | 현재 답안을 그대로 인정 |
| 23 | reform | 개혁하다 | correct | 현재 답안을 그대로 인정 |
| 24 | inclination | 경향 | correct | 현재 답안을 그대로 인정 |
| 25 | constituent | 구성요소 | correct | 현재 답안을 그대로 인정 |
| 26 | insolent |  | blank | 건방진; 무례한 |
| 27 | be accompanied by | ~와 동반되다 | correct | 현재 답안을 그대로 인정 |
| 28 | broadly | 대체로 | correct | 현재 답안을 그대로 인정 |
| 29 | whereby | ~에 의하여 | correct | 현재 답안을 그대로 인정 |
| 30 | liberate | 해방하다 | correct | 현재 답안을 그대로 인정 |

## 내일 우선 복습

- `peril`, `arduous`, `insolent`: 공란 반복이라 1순위
- `palatial`, `intricate`, `eclectic`, `turmoil`, `crude`, `materialize`, `profuse`: 부분 정답이라 정확한 뉘앙스 보강 필요

## Machine-Readable Grading Records

```jsonl
{"word":"palatial","user_answer":"궁정의","canonical_meaning":"궁전 같은; 매우 호화로운","verdict":"partial","reason_ko":"'궁정의'는 관련성은 있지만 '궁전 같은/매우 호화로운' 뉘앙스를 충분히 특정하지 못합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=궁전 같은, alt_meanings_ko=매우 호화로운을 근거로 판단했습니다.","accepted_range_ko":"궁전 같은; 매우 호화로운","correction_ko":"palatial은 '궁전 같은; 매우 호화로운'으로 기억하는 것이 안전합니다.","error_types":["nuance_mismatch","accepted_but_imprecise"],"confidence":"high"}
{"word":"potent","user_answer":"강력한","canonical_meaning":"강력한; 효력이 큰; 설득력 있는","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=강력한, alt_meanings_ko=효력이 큰; 설득력 있는을 근거로 판단했습니다.","accepted_range_ko":"강력한; 효력이 큰; 설득력 있는","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"intricate","user_answer":"복잡한","canonical_meaning":"복잡하게 얽힌; 정교한; 세밀한","verdict":"partial","reason_ko":"'복잡한'은 가까운 답이지만 intricate의 '복잡하게 얽힌/정교한' 뉘앙스가 부족합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=복잡하게 얽힌, alt_meanings_ko=정교한; 세밀한을 근거로 판단했습니다.","accepted_range_ko":"복잡하게 얽힌; 정교한; 세밀한","correction_ko":"intricate는 '복잡하게 얽힌; 정교한'까지 같이 기억하세요.","error_types":["accepted_but_imprecise"],"confidence":"high"}
{"word":"eclectic","user_answer":"다방면의","canonical_meaning":"절충적인; 여러 요소를 취한; 취향이 폭넓은","verdict":"partial","reason_ko":"'다방면의'는 너무 넓어서 eclectic의 '여러 데서 골라 조합한' 의미를 충분히 못 잡습니다.","evidence_ko":"master_words.csv의 core_meaning_ko=절충적인, alt_meanings_ko=여러 요소를 취한; 취향이 폭넓은, accepted_paraphrases_ko와 grading_notes를 근거로 판단했습니다.","accepted_range_ko":"절충적인; 여러 요소를 취한; 다양한 데서 골라 모은; 취향이 폭넓은","correction_ko":"eclectic은 '절충적인; 여러 요소를 골라 취한'으로 답하면 안전합니다.","error_types":["nuance_mismatch","accepted_but_imprecise"],"confidence":"high"}
{"word":"turmoil","user_answer":"소란","canonical_meaning":"혼란; 소동; 격변","verdict":"partial","reason_ko":"'소란'은 일부 맞지만 turmoil은 단순 소란보다 더 큰 혼란이나 격변을 뜻할 수 있습니다.","evidence_ko":"master_words.csv의 core_meaning_ko=혼란, alt_meanings_ko=소동; 격변을 근거로 판단했습니다.","accepted_range_ko":"혼란; 소동; 격변","correction_ko":"turmoil은 '혼란; 소동; 격변'으로 넓게 기억하세요.","error_types":["accepted_but_imprecise"],"confidence":"high"}
{"word":"preeminent","user_answer":"최상의","canonical_meaning":"탁월한; 뛰어난; 두드러진","verdict":"correct","reason_ko":"'최상의'는 preeminent의 가장 뛰어남/탁월함 의미와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=탁월한, alt_meanings_ko=뛰어난; 두드러진을 근거로 판단했습니다.","accepted_range_ko":"탁월한; 뛰어난; 두드러진; 최상의","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"recompense","user_answer":"보상하다","canonical_meaning":"보상하다; 보상; 배상","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=보상하다, alt_meanings_ko=보상; 배상을 근거로 판단했습니다.","accepted_range_ko":"보상하다; 보상; 배상","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"crude","user_answer":"단순하다","canonical_meaning":"조잡한; 대략의; 가공되지 않은","verdict":"partial","reason_ko":"'단순하다'는 너무 넓고, crude의 '조잡한/대략의/가공되지 않은' 뉘앙스가 빠져 있습니다.","evidence_ko":"master_words.csv의 core_meaning_ko=조잡한, alt_meanings_ko=대략의; 가공되지 않은, notes를 근거로 판단했습니다.","accepted_range_ko":"조잡한; 대략의; 가공되지 않은","correction_ko":"crude는 '조잡한; 대략의; 가공되지 않은'으로 정리하세요.","error_types":["nuance_mismatch","accepted_but_imprecise"],"confidence":"high"}
{"word":"proliferate","user_answer":"증식하다","canonical_meaning":"급증하다; 증식하다; 확산되다","verdict":"correct","reason_ko":"제출 답안이 alt_meanings_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=급증하다, alt_meanings_ko=증식하다; 확산되다를 근거로 판단했습니다.","accepted_range_ko":"급증하다; 증식하다; 확산되다","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"assess","user_answer":"평가하다","canonical_meaning":"평가하다; 산정하다; 가늠하다","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=평가하다, alt_meanings_ko=산정하다; 가늠하다를 근거로 판단했습니다.","accepted_range_ko":"평가하다; 산정하다; 가늠하다","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"scrutiny","user_answer":"정밀조사","canonical_meaning":"면밀한 조사; 정밀 검토","verdict":"correct","reason_ko":"'정밀조사'는 면밀한 조사/정밀 검토와 같은 의미로 인정됩니다.","evidence_ko":"master_words.csv의 core_meaning_ko=면밀한 조사, alt_meanings_ko=정밀 검토를 근거로 판단했습니다.","accepted_range_ko":"면밀한 조사; 정밀 검토; 정밀조사","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"acute","user_answer":"극심한","canonical_meaning":"심각한; 예리한; 급성의","verdict":"correct","reason_ko":"'극심한'은 acute의 심각한/severe 의미로 인정됩니다.","evidence_ko":"master_words.csv의 core_meaning_ko=심각한, alt_meanings_ko=예리한; 급성의를 근거로 판단했습니다.","accepted_range_ko":"심각한; 극심한; 예리한; 급성의","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"inadvertently","user_answer":"우연히","canonical_meaning":"무심코; 부주의하게","verdict":"correct","reason_ko":"'우연히'는 의도하지 않고 일어난다는 점에서 inadvertently의 허용 paraphrase로 인정됩니다.","evidence_ko":"master_words.csv의 core_meaning_ko=무심코, alt_meanings_ko=부주의하게을 근거로 판단했습니다.","accepted_range_ko":"무심코; 부주의하게; 우연히","correction_ko":"현재 답안을 인정하되, '무심코/부주의하게' 뉘앙스도 같이 기억하세요.","error_types":[],"confidence":"medium"}
{"word":"peril","user_answer":"","canonical_meaning":"위험; 위난; 위험한 상황","verdict":"blank","reason_ko":"답안이 비어 있어 미응답으로 처리했습니다.","evidence_ko":"master_words.csv의 core_meaning_ko=위험, alt_meanings_ko=위난; 위험한 상황을 근거로 판단했습니다.","accepted_range_ko":"위험; 위난; 위험한 상황","correction_ko":"peril의 핵심 의미는 '위험; 위험한 상황'입니다.","error_types":["blank"],"confidence":"high"}
{"word":"arduous","user_answer":"","canonical_meaning":"고된; 힘든; 힘겨운","verdict":"blank","reason_ko":"답안이 비어 있어 미응답으로 처리했습니다.","evidence_ko":"master_words.csv의 core_meaning_ko=고된, alt_meanings_ko=힘든; 힘겨운을 근거로 판단했습니다.","accepted_range_ko":"고된; 힘든; 힘겨운","correction_ko":"arduous의 핵심 의미는 '고된; 힘든'입니다.","error_types":["blank"],"confidence":"high"}
{"word":"materialize","user_answer":"구현화하다","canonical_meaning":"실현되다; 나타나다; 구체화되다","verdict":"partial","reason_ko":"'구현화하다'는 방향은 맞지만 '실현되다/나타나다/구체화되다'로 답하는 것이 더 정확합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=실현되다, alt_meanings_ko=나타나다; 구체화되다, notes를 근거로 판단했습니다.","accepted_range_ko":"실현되다; 나타나다; 구체화되다","correction_ko":"materialize는 '실현되다; 나타나다; 구체화되다'로 기억하세요.","error_types":["part_of_speech_mismatch","accepted_but_imprecise"],"confidence":"high"}
{"word":"demise","user_answer":"죽음","canonical_meaning":"죽음; 종말; 몰락","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=죽음, alt_meanings_ko=종말; 몰락을 근거로 판단했습니다.","accepted_range_ko":"죽음; 종말; 몰락","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"deem","user_answer":"간주하다","canonical_meaning":"간주하다; 여기다","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=간주하다, alt_meanings_ko=여기다를 근거로 판단했습니다.","accepted_range_ko":"간주하다; 여기다","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"profuse","user_answer":"많은","canonical_meaning":"풍부한; 과도한; 많이 흘리는","verdict":"partial","reason_ko":"'많은'은 너무 일반적이고 profuse의 '풍부한/과도한' 정도감이 약합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=풍부한, alt_meanings_ko=과도한; 많이 흘리는, notes를 근거로 판단했습니다.","accepted_range_ko":"풍부한; 과도한; 많이 흘리는","correction_ko":"profuse는 '풍부한; 과도한; 많이 흘리는'으로 정리하세요.","error_types":["accepted_but_imprecise"],"confidence":"high"}
{"word":"ornament","user_answer":"장식품","canonical_meaning":"장식물; 장식하다","verdict":"correct","reason_ko":"'장식품'은 core_meaning_ko=장식물과 같은 의미로 인정됩니다.","evidence_ko":"master_words.csv의 core_meaning_ko=장식물, alt_meanings_ko=장식하다를 근거로 판단했습니다.","accepted_range_ko":"장식물; 장식품; 장식하다","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"demolish","user_answer":"철거하다","canonical_meaning":"파괴하다; 철거하다","verdict":"correct","reason_ko":"제출 답안이 alt_meanings_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=파괴하다, alt_meanings_ko=철거하다를 근거로 판단했습니다.","accepted_range_ko":"파괴하다; 철거하다","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"voracious","user_answer":"게걸스러운","canonical_meaning":"게걸스러운; 탐욕스러운; 욕구가 왕성한","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=게걸스러운, alt_meanings_ko=탐욕스러운; 욕구가 왕성한, notes를 근거로 판단했습니다.","accepted_range_ko":"게걸스러운; 탐욕스러운; 욕구가 왕성한","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"reform","user_answer":"개혁하다","canonical_meaning":"개혁하다; 개혁; 개선하다","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=개혁하다, alt_meanings_ko=개혁; 개선하다를 근거로 판단했습니다.","accepted_range_ko":"개혁하다; 개혁; 개선하다","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"inclination","user_answer":"경향","canonical_meaning":"성향; 경향; 기울기","verdict":"correct","reason_ko":"제출 답안이 alt_meanings_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=성향, alt_meanings_ko=경향; 기울기를 근거로 판단했습니다.","accepted_range_ko":"성향; 경향; 기울기","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"constituent","user_answer":"구성요소","canonical_meaning":"구성 요소; 성분; 선거구민","verdict":"correct","reason_ko":"'구성요소'는 core_meaning_ko=구성 요소와 표기 차이만 있어 정답입니다.","evidence_ko":"master_words.csv의 core_meaning_ko=구성 요소, alt_meanings_ko=성분; 선거구민, notes를 근거로 판단했습니다.","accepted_range_ko":"구성 요소; 구성요소; 성분; 선거구민","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"insolent","user_answer":"","canonical_meaning":"건방진; 무례한","verdict":"blank","reason_ko":"답안이 비어 있어 미응답으로 처리했습니다.","evidence_ko":"master_words.csv의 core_meaning_ko=건방진, alt_meanings_ko=무례한을 근거로 판단했습니다.","accepted_range_ko":"건방진; 무례한","correction_ko":"insolent의 핵심 의미는 '건방진; 무례한'입니다.","error_types":["blank"],"confidence":"high"}
{"word":"be accompanied by","user_answer":"~와 동반되다","canonical_meaning":"동반되다; ~과 함께 오다; ~이 수반되다","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv의 core_meaning_ko=동반되다, alt_meanings_ko=~과 함께 오다; ~이 수반되다, notes=phrase_entry를 근거로 판단했습니다.","accepted_range_ko":"동반되다; ~와 동반되다; ~과 함께 오다; ~이 수반되다","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"broadly","user_answer":"대체로","canonical_meaning":"대체로; 넓게; 광범위하게","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv에 신규 추가한 row의 core_meaning_ko=대체로, alt_meanings_ko=넓게; 광범위하게, accepted_paraphrases_ko=대체로; 대략; 넓게; 광범위하게을 근거로 판단했습니다.","accepted_range_ko":"대체로; 대략; 넓게; 광범위하게","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"whereby","user_answer":"~에 의하여","canonical_meaning":"그것에 의하여; ~하는 방식으로; 그것에 의해","verdict":"correct","reason_ko":"제출 답안이 accepted_paraphrases_ko와 일치합니다.","evidence_ko":"master_words.csv에 신규 추가한 row의 core_meaning_ko=그것에 의하여, alt_meanings_ko=~하는 방식으로; 그것에 의해, accepted_paraphrases_ko=~에 의하여; 그것에 의하여; 그것에 의해; ~하는 방식으로을 근거로 판단했습니다.","accepted_range_ko":"~에 의하여; 그것에 의하여; 그것에 의해; ~하는 방식으로","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
{"word":"liberate","user_answer":"해방하다","canonical_meaning":"해방하다; 자유롭게 하다; 석방하다","verdict":"correct","reason_ko":"제출 답안이 core_meaning_ko와 일치합니다.","evidence_ko":"master_words.csv에 신규 추가한 row의 core_meaning_ko=해방하다, alt_meanings_ko=자유롭게 하다; 석방하다, accepted_paraphrases_ko=해방하다; 자유롭게 하다; 석방하다를 근거로 판단했습니다.","accepted_range_ko":"해방하다; 자유롭게 하다; 석방하다","correction_ko":"현재 답안을 그대로 인정할 수 있습니다.","error_types":[],"confidence":"high"}
```
