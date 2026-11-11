# perf/user-flow-load-test — 질문 → 결과 → 근거 · 원문 → 시공간 사용자 여정 부하 시험

- Jira: S15P31C108-340 · PRD: — · 묶음/단위: P7

## 완료 조건
- [x] `backend/loadtest/` 에 여정 k6 시나리오와 실행법이 있다 — `journey.js` · `journey.sh` · `dev-data.sh` · `journey_report.py`, README 「여정 시험」
- [x] `docs/perf/` 에 API별 p50 · p95 · p99 · 처리량 · 오류율 표가 있다 — `docs/perf/user-flow-load-test.md`
- [x] 병목(DB 쿼리 · 외부 호출 · 동기 처리)과 개선안이 정리돼 있다 — 같은 문서 「병목」「개선안」
- [x] pnpm check 통과 — backend format · backend test PASS(2026-11-10)

## 진행
- 2026-11-10: 시작. 앞 시험(-260 · -261)은 질문 POST + `GET /v1/places` 만, 빈 DB + 카드 시드로 쟀다.
  이번은 dev 데이터 덤프(읽기 전용, raw_record 본문 제외)를 올린 로컬에서 여정 전체를 동시 1→100명으로 잰다(사람 확인).
  dev(운영과 같은 EC2)에는 부하를 주지 않는다.
- 2026-11-10: dev 덤프(약 15초, Flyway V0054) → 로컬 `issue_atlas_seed`(:55433). backend · DB 컨테이너 CPU 2개씩.
  여정 시험(가짜 engine 5초): 508회 · 오류 0, DB CPU 가 25명에서 포화, 100명에서 질문 p95 42 s · 조회 p95 10 s.
  읽기만 시험: 100명에서도 결과 · 근거 p95 4 ms → 조회 지연은 풀 대기. DB 시간 63% 가 `EvidenceMatchSql.PRESS`(질문당 4회).
  dev 실측(argument_run): 1명일 때 5~8초는 문장화가 대부분, 서버 몫 p50 약 0.9 s.
- 2026-11-11: 팀원이 다시 돌릴 수 있게 README 에 준비물 · 덤프 넘기는 법 · Linux 차이를 적고 MR 로 올림.

## 다음 할 일 / 범위 밖
- 개선안 1 · 4 · 5 · 6(backend 만): 보도자료 매칭 1회로 · 근거 INSERT 먼저 커밋 · 질문 동시 실행 상한 · 카드 목록 캐시 — 각자 이슈로
- 개선안 2 · 3(정제 · DB 계약): 보도자료 칸 열 꺼내 색인 · 관측 물질화 — P2(박준우) · 서버 담당 협의
- 고친 뒤 같은 조건(`journey.sh`, 같은 덤프)으로 다시 재서 전 · 후 비교
- Next.js 서버 렌더링 · 실제 engine(GMS) 동시 한도는 재지 않았다
