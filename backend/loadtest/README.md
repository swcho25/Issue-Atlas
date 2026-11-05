# 질문 부하 시험

`POST /v1/questions` 가 몰릴 때 처리량 · 응답 시간 · 커넥션 풀을 잰다(S15P31C108-260). 결과와 해석은
[docs/perf/question-load-test.md](../../docs/perf/question-load-test.md) · [phrasing-cache.md](../../docs/perf/phrasing-cache.md).

| 파일 | 하는 일 |
| --- | --- |
| `run.sh` | 빈 PostGIS(:55432) · 가짜 engine(:18000) · backend jar(:18080)를 띄우고 카드 시드 → k6 → 모두 내린다 |
| `fake_engine.py` | `POST /v1/argument/phrase` 에 `DELAY_SECONDS` 기다렸다가 done. 실제 LLM 지연만 흉내 낸다. `GET /stats` = 호출 수 |
| `question.js` | k6. `questions`(동시 N명이 쉬지 않고 질문) + `probe`(초당 N건 `GET /v1/places`) |
| `report.py` | 결과 폴더들 → 마크다운 표 + SVG 그래프 |

## 준비
- Docker(DB · k6 이미지), Java 21, Python 3. 로컬 DB(:5432)와 따로 돈다
- DB 이미지가 없으면 `run.sh` 가 `docker compose build postgres` 로 만든다

## 실행 (루트에서)
```bash
(cd backend && ./gradlew bootJar -x test)
bash backend/loadtest/run.sh backend/build/libs/backend-0.0.1-SNAPSHOT.jar backend/loadtest/out/after
PYTHONIOENCODING=utf-8 python backend/loadtest/report.py --svg backend/loadtest/out/graph.svg 고친뒤=backend/loadtest/out/after
```
결과 폴더 `backend/loadtest/out/` 은 git 이 무시한다. 옛 코드와 비교하려면 `git worktree add --detach <폴더> <커밋>` 으로 그 커밋 jar 를 따로 만들어 같은 조건으로 돌린다.

| 환경 변수 | 기본 | 뜻 |
| --- | --- | --- |
| `DELAY_SECONDS` | 13 | 가짜 engine 지연(실측 문장화 평균 13초) |
| `QUESTION_VUS` | 30 | 동시에 질문하는 사람 수 |
| `PROBE_RPS` | 5 | 조회 API 초당 요청 |
| `DURATION` | 120s | 시험 시간 |
| `ENGINE_CACHE_SIZE` | (backend 기본 500) | backend 로 그대로 넘어간다. `0` 이면 문장화 캐시를 끈다(S15P31C108-261) |

## 재는 것
- k6: 요청별 응답 시간 · 상태(`k6.csv`), 요약(`summary.json`)
- Hikari: `-Dcom.zaxxer.hikari.housekeeping.periodMs=1000` + DEBUG 로 1초마다 `active` · `waiting`(`pool.log`)
- PostgreSQL: 1초마다 `pg_stat_activity` 의 `active` · `idle in transaction`(`pg.csv`) — 트랜잭션을 연 채 기다리는 연결
- 질문 한도(`QUESTIONS_PER_MINUTE`)는 시험에서 끈다. 운영 값이 아니다
