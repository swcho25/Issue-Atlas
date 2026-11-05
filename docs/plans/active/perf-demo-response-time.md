# perf/demo-response-time — 데모 API 응답 시간 측정과 운영 배포 리허설

- Jira: S15P31C108-178 · 마감 11/13 · 묶음/단위: P7

## 완료 조건
- [x] 개발 서버에서 데모 흐름 API 7개(`GET /v1/places` · `/v1/places/{id}/cards` · `/v1/places/{id}/boundaries` · `POST /v1/questions` · `GET /v1/arguments/{run_id}` · `/v1/evidence/{id}` · `/v1/observations`)를 각 20회 재는 스크립트(`deploy/dev/measure.py`)가 있고, 중앙값 · p95 표를 이 계획에 남긴다 (질문은 개발 DB 행 · 분당 10건 제한 때문에 3회)
- [ ] p95 가 목표(PRD 성능 기준, 없으면 조회 1초 · 질문 3초)를 넘는 API 마다 원인(서버 처리 · DB 쿼리 · 응답 크기 · 네트워크/Cloudflare)을 나눠 적고, 고칠 것과 미룰 것을 정한다
- [x] 운영 배포 리허설 체크리스트(develop → main MR, 운영 DB Flyway 순서, 운영 Tunnel origin, 운영 health · 질문 1건 · 로그인 확인, 실패 시 복구)를 `deploy/ci/README.md` 에 쓴다. main 병합 · 운영 배포 실행은 사람 승인 뒤
- [ ] 운영 리허설을 실제로 했으면 결과(걸린 시간 · 막힌 곳)를 남긴다

## 진행
- 2026-11-05: 시작. 개발 · 운영 `/actuator/health` 가 둘 다 200 이지만 약 4초(curl total) — 측정 1순위. main 은 develop 보다 356커밋 뒤(마지막 반영 10/30)
- 2026-11-05: 참고 — `argument_run.duration_ms`(V0033)에 질문 실행 서버 시간이 이미 쌓인다. 측정값과 비교해 서버 밖 시간을 가른다

- 2026-11-05: 1차 측정(SSAFY 망 PC → dev-backend, 연결 재사용 · gzip, 여수 C1/A3 2023–2025). 첫 연결(TCP + TLS) 591 ms

| API | 횟수 | 중앙값 ms | p95 ms | 최대 ms | 응답 바이트(gzip) |
| --- | ---: | ---: | ---: | ---: | ---: |
| health (바닥값) | 20 | 573 | 2072 | 3730 | 71 |
| GET /v1/places | 20 | 570 | 2093 | 2126 | 315 |
| GET /v1/places/{id}/cards | 20 | 565 | 2721 | 3213 | 466 |
| GET /v1/places/{id}/boundaries | 20 | 2212 | 4149 | 4167 | 47,893 |
| GET /v1/arguments/{run_id} | 20 | 2140 | 3341 | 3381 | 17,362 |
| GET /v1/evidence/{id} | 20 | 1129 | 2099 | 2108 | 649 |
| GET /v1/observations (A3) | 20 | 3581 | 8475 | 13204 | 8,978 |
| POST /v1/questions | 2 | 12409 | 12720 | 12720 | 173 |

- 원인 1 — **Cloudflare 가 한국 요청을 LA(LAX) 엣지로 보낸다**: `/cdn-cgi/trace` 가 `colo=LAX · loc=KR`, 터널을 안 타는 trace 도 0.87 s. 서버 일이 없는 health 가 중앙값 0.57 s · p95 2 s 인 바닥값이 이것. 응답이 큰 경계(48 KB) · 논증(17 KB)은 왕복이 늘어 바닥값 + 약 1.6 s. 코드로 못 고친다
- 원인 2 — **문장화(LLM)가 이미 켜져 있다**: 측정한 실행의 `warrant.provenance = llm_phrasing`, 반박 4개 `llm_judgment`. 질문 12 s 의 대부분이 engine → GMS 호출(-243 `ENGINE_URL` 이 켜짐)
- ~~원인 3 — observations 는 서버 쪽~~ → **정정(같은 날 재측정)**: health 와 번갈아 20회씩 재니 observations TTFB 중앙값 1.09 s(health 0.53 s), 전체 1.26 s(health 0.72 s). 1달(9행) · 12달 · 36달(324행)도 TTFB 가 바닥값과 같은 0.5 s 인 때가 많다. 1차의 3.6 s 는 LAX 경로 흔들림이었다. 쿼리는 `air_monthly` PK(station_code, indicator_id, month_start)를 타고 place 는 약 180행이라 코드 수정 근거가 없다
- 나머지(places · cards · evidence)도 바닥값 + 0~0.6 s. **밖에서 재서는 서버 시간을 바닥값 0.5 s 아래로 가를 수 없다** → EC2 안에서 `python3 deploy/dev/measure.py --base-url http://127.0.0.1:8080` 로 네트워크 없이 다시 잰다(서버 담당)

- 2026-11-05: 운영 현황 — `backend.issue-atlas.kr` 은 별도 운영 backend 로 main `8281550`(10/30) 판이 돈다(경계 API 401 = 옛 로그인 정책), `issue-atlas.kr/healthz` revision 도 같다. 다음 반영은 migration V0015–V0046(32개). 카드 시드 `db/seed/cards-c1-a3.sql` 은 Flyway 밖, 운영 DB 자동 백업 없음, 운영 수집 자료 없음 → 체크리스트 「전날」에 결정 항목으로 넣음

## 다음 할 일 / 범위 밖
- 정할 것: Cloudflare LAX 경로(요금제 · Argo · 다른 경로) — 팀 결정. 데모장 망에서 다시 재기
- 질문 12 s: engine 호출 시간을 `argument_run.duration_ms` · engine 로그로 나누고, 화면 로딩 표시 또는 문장화 비동기 여부 결정
- EC2 안 측정(위)에서 서버 시간이 0.3 s 를 넘는 API 가 나오면 그때 쿼리 확인(EXPLAIN ANALYZE)
- 운영 수집기 API 키 · 실제 수집 실행은 범위 밖(-137)
