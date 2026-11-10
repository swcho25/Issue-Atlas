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

## 여정 시험 (S15P31C108-340)
질문 → 결과 → 지도 → 원문 탭으로 이어지는 사용자 여정을 **dev 데이터 사본** 위에서 동시 1 → 100명으로 잰다.
결과와 해석은 [docs/perf/user-flow-load-test.md](../../docs/perf/user-flow-load-test.md).
dev · 운영이 같은 EC2 라 **dev 에는 부하를 주지 않는다**. dev 에서는 읽기 전용 덤프만 한 번 받는다(약 15초).

| 파일 | 하는 일 |
| --- | --- |
| `dev-data.sh` | `dump`: dev DB 를 읽기 전용으로 덤프(`raw_record` 는 참조된 행만, `app_user` 는 이메일 · 비밀번호 지움). `restore`: 로컬 PostGIS(:55433, 볼륨 `atlas-journey-pgdata`)의 `issue_atlas_seed` 로 복원 |
| `journey.sh` | 시험마다 `issue_atlas_seed` 를 복사해 새 `issue_atlas` → 가짜 engine(:18001) · backend 컨테이너(CPU 제한) · k6 → 쿼리 통계 · 실행별 시간 저장 |
| `journey.js` | k6. `MODE=journey`(질문부터 원문 탭까지) · `MODE=read`(미리 만든 결과 24개를 열기만) |
| `journey_report.py` | 결과 폴더 → API 별 · 동시 사용자 단계별 · 질문 서버 시간 · DB 쿼리 상위 표 |

```bash
# 한 번: dev 덤프(SSH 키 SSH_KEY, 기본 ~/Downloads/K15C108T.pem) → 로컬 복원(약 30초). 덤프 폴더는 저장소 밖에
bash backend/loadtest/dev-data.sh dump ../atlas-devdump
bash backend/loadtest/dev-data.sh restore ../atlas-devdump
# 시험마다
(cd backend && ./gradlew bootJar -x test)
bash backend/loadtest/journey.sh backend/build/libs/backend-0.0.1-SNAPSHOT.jar backend/loadtest/out/journey
MODE=read bash backend/loadtest/journey.sh backend/build/libs/backend-0.0.1-SNAPSHOT.jar backend/loadtest/out/read
PYTHONIOENCODING=utf-8 python backend/loadtest/journey_report.py backend/loadtest/out/journey
```
`python` 이 없으면 `PYTHON="uv run --no-project python"` 을 앞에 붙인다(가짜 engine 실행에 쓴다).

| 환경 변수 | 기본 | 뜻 |
| --- | --- | --- |
| `MODE` | journey | `read` 면 질문 없이 결과 화면만 |
| `DELAY_SECONDS` | 5 | 가짜 engine 지연(dev 문장화 p50 2.8~6.7초) |
| `PEAK_VUS` | 100 | 최대 동시 사용자. 1 → 10% → 25% → 50% → 100% 단계, 6분 |
| `STAGES` | — | k6 단계 JSON 으로 바꾸기(예: `'[{"duration":"30s","target":3}]'`) |
| `THINK_SECONDS` | 1 | 화면 사이 생각 시간(0.5~1.5배) |
| `EVIDENCE_PER_VISIT` | 3 | 원문 탭에서 여는 근거 수 |
| `APP_CPUS` · `DB_CPUS` | 2 · 2 | 컨테이너 CPU 제한(EC2 4코어를 dev · 운영이 나눔) |
| `HIKARI_MAX` · `ENGINE_CACHE_SIZE` | backend 기본 | backend 로 넘긴다 |

결과 폴더에는 앞 시험의 파일에 더해 `statements.csv`(`pg_stat_statements` 총 시간 상위 40) · `runs.csv`(실행별 전체 · 문장화 시간,
근거 행 수) · `stats.csv`(컨테이너 CPU · 메모리 2초)가 생긴다. DB 컨테이너는 시험 뒤에도 남는다(`docker rm -f atlas-journey-pg`).
