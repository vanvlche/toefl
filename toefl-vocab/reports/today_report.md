# 오늘 채점 리포트

- 날짜: 2026-04-25
- 최근 세션: `2026-04-25_test_02`
- 최근 채점 요약: 총 10문항에서 `correct 3`, `partial 1`, `wrong 3`, `blank 3`
- 오늘 누적 요약: 총 40문항에서 `correct 23`, `partial 8`, `wrong 3`, `blank 6`
- 메모: 첫 줄의 `2026-04-25_test_02`는 세션 식별자로 보고 채점 대상에서 제외했다.
- 데이터 메모: `tremendous`, `cope with`, `inducement`, `comprise`, `allegiance`, `idiosyncrasy`, `minute`, `markedly`, `disseminate`, `detrimental`은 세션 신규 단어로 `master_words.csv`와 `review_queue.csv`에 추가했다.

## 주요 약점
- 공란 응답: `cope with`, `disseminate`, `detrimental`
- 의미 혼동: `inducement`, `allegiance`, `markedly`
- 뉘앙스가 약하거나 지나치게 넓은 답: `idiosyncrasy`
- 오늘 반복 취약 흐름: 공란과 형태가 비슷한 단어 혼동이 점수 손실의 중심이다.

## 내일 우선 복습
- `cope with`, `disseminate`, `detrimental`
- `inducement`, `allegiance`, `markedly`
- `idiosyncrasy`

## 간단 코멘트
- `tremendous`, `comprise`, `minute`는 정답 처리했다.
- `inducment`는 `inducement` 오탈자로 정규화했다.
- `allegiance`는 `alliance/ally`와 분리해서 기억해야 한다.
