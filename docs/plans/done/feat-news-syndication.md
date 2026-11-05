# feat/news-syndication — 기사 전재 묶기

- Jira: S15P31C108-267 · PRD: (P2 정제) · 묶음/단위: P2 — 회사 2주 플랜 표 2 박준우 11/13 「기사 전재 묶기」

## 완료 조건
- [x] 정제된 최신 기사(normalized_ready, kind = news)를 제목 글자 2개 묶음 유사도(Jaccard) 0.7 이상 · 발행일 3일 안이면 같은 전재 묶음으로 잇는다(연결 요소). 묶음 번호 = 묶음에서 가장 먼저 발행된 기사의 news_id — `engine/tests/test_syndication.py`
- [x] 결과는 새 표 `news_syndication`(V0047)에 기사마다 한 행(혼자인 기사도). 규칙 판 `syn-0.1` — `engine/tests_postgres/test_syndication_store.py`
- [x] `python -m pipeline.refine.syndication --db` 는 시험 실행(건수만), `--apply` 로 전체를 다시 쓴다. 서버 실행기 모드 `syndicate` — `deploy/tests/test_collector_runner.py`
- [ ] 개발 DB 적용 뒤 묶음 수 확인 (11/5 측정: 172묶음 · 434건) — 병합 · 배포 · 실행기 재설치 뒤

## 진행
- 2026-11-05: 개발 DB 기사 3,483건 제목으로 측정. 같은 제목만 107묶음 · 246건, Jaccard 0.7 172묶음 · 434건(최대 5), 0.6 210묶음 · 551건. 0.6 표본에서 다른 기관의 같은 행사 기사(나눔캠페인 성금)가 섞여 0.7. 3일 창은 한국 날짜 기준. 본문은 지운 뒤라 제목 · 발행일만 쓴다. 정제 레코드 칸에 넣지 않고 따로 표를 둔 이유: 묶음은 기사 사이 관계라 기사 하나씩 도는 정제(출처 · 관측 일 묶음 단위)와 맞지 않고, 정제를 다시 돌리지 않고도 규칙만 바꿔 다시 묶을 수 있게

## 다음 할 일 / 범위 밖
- 근거 기사 목록(C2 `articles[]`) · 기사 건수 그림을 묶음 단위로 세기 — 응답(P7, 장성우) 쪽 MR
- 최동준 분류 실험의 「중복 그룹」과 기준 맞추기(교차검증 · 새 표본 고를 때 이 표를 쓰게)
- 빅카인즈 매일 수집이 생기면 수집 · 정제 뒤 `syndicate --apply` 를 이어 돌리기
- 서버 관리자: `/usr/local/sbin/issueatlas-collect` 를 새 run_collector.py 로 다시 설치(CD 가 갱신하지 않음)
