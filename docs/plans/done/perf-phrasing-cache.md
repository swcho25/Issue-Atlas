# perf/phrasing-cache — 같은 질문의 문장화 결과를 다시 써서 engine 호출 줄이기

- Jira: S15P31C108-261 · 앞 작업: S15P31C108-260(perf/question-load-test, 이 브랜치의 바탕) · 묶음/단위: P4

## 완료 조건
- [x] 문장화 요청(run_id 제외)이 같으면 engine 을 다시 부르지 않고 같은 ③ 보증 · ⑤ 반박을 쓴다(테스트)
- [x] 같은 요청이 동시에 몰려도 engine 은 한 번만 불린다(테스트)
- [x] done 이 아닌 결과(실패 · 시간 초과 · 건너뜀)는 캐시하지 않는다. C2 응답 · argument_phrasing 사유 코드 형식은 그대로다
- [x] 부하 시험으로 캐시 전·후 engine 호출 수와 응답 시간을 기록했다
- [x] corepack pnpm check 통과

## 진행
- 2026-11-05: 시작. 서버 메모리 캐시로 결정(사용자 선택, DB · 계약 변경 없음). 키 = 요청에서 run_id · question_id 를 뺀 JSON 의 SHA-256
- 2026-11-05: PhrasingCache(done 만 · single-flight · 500개 · 24시간, ENGINE_CACHE_SIZE=0 이면 끔) + ArgumentPhraser 연결.
  PhrasingCacheTest 5개, QuestionApiTest 시나리오 2개(같은 질문 재사용 · 실패는 안 담고 다른 기간은 다시 부름). 기존 테스트는 테스트마다 캐시를 비움
- 2026-11-05: 부하 시험(같은 질문 30명 · 13초 · 2분) engine 호출 300 → 1, 질문 p50 13.0 → 0.13초. 다음 병목은 DB(풀 10개 내내 참, 조회 p95 12 → 87ms).
  docs/perf/phrasing-cache.md · .svg. report.py 에 --title · 큰 수 눈금 · 라벨 겹침 처리
- 2026-11-05: pnpm check · check:all 통과

## 다음 할 일 / 범위 밖
- 캐시로 LLM 대기가 사라지면 DB 가 병목: 판정 조회 · 저장 쿼리 수와 풀 크기는 범위 밖(실제 트래픽 근거가 생기면)
- 서버가 여러 대가 되면 공용 캐시(Redis 등) 필요
