# feat/region-pipeline-rules — P3 지역 · 시간 규칙 engine 이전 (MR 1/3)

- Jira: S15P31C108-190 · PRD: 7.6 · 5.4 · 묶음/단위: P3-6 · P3-7 · P3-8

## 완료 조건
- [x] `engine/pipeline/region` 패키지: 이름 체계(labels) · 지명 사전(places, 법정동 코드 3,446행) · 본문 앞부분 정리(text)
- [x] 여러 지역 규칙(regions): 대표 지역 + 제목 · 첫 200자 지명, 전국 · 5곳 이상 · 부고 · 경기 광주 규칙
- [x] 적재 검사(checks): 분석 기간 밖 → published, 긴 day → month, 형식 위반(place_id 2 · 5 · 8 · 10자리, regions 첫 원소 = 대표 지역)
- [x] 본문을 지워도 되는 요약 판정(checks.good_summary): 20–300자 · 요약 앞 60자가 본문에 그대로 있지 않음 (기사 계약 v0.3)
- [x] lab 테스트 이전, `pnpm engine:lint` · `engine:test` 통과 (482개, P3 23개)

## 진행
- 2026-11-02: 시작. P3 를 로컬(p3-region-lab) · 주피터에서 서버로 옮기는 3개 MR 중 1. 네트워크 · DB 없는 규칙만
- 2026-11-02: 결정 — LLM(Qwen2.5-32B-AWQ, 프롬프트 p9.1)은 주피터 GPU 1번에 남긴다(수집기 이미지는 CPU 1 · 메모리 1GB). 나머지는 `issueatlas-collect region-export` · `region-load`
- 2026-11-02: 결정(정우현) — 본문 지우기는 파이프라인(MR 1 ~ 3)을 마친 뒤, 시험 실행으로 건수(지울 3,435 · 남길 48)를 확인하고
- 2026-11-02: 법정동 코드 파일(3.2MB)에서 필요한 행만(우리 통합시 전체 · 전국 시군구 이름) `pipeline/region/data/region_names.tsv`(약 220KB)로
- 2026-11-02: 본문 정리 함수는 dict 대신 (제목, 본문) 인자로 — 서버 입력 칸 이름에 묶이지 않게

## 다음 할 일 / 범위 밖
- MR 2: `region-export`(새 기사 → JSONL) · `region-load`(지오코딩 JUSO · SGIS → 위치 → 검사 → regions → `news_event` 저장 → `--delete-bodies` 로 요약된 기사 본문 지우기, 기본은 시험 실행), 수집기 모드 등록, `.env.example` 키 이름(JUSO · SGIS), 요약은 `COALESCE(새 요약, 기존 요약)`
- MR 3: 주피터 실행기 `pipeline.region.extract`(프롬프트 p9.1 · 후처리 · 요약 · 사건 시간 · mentions, vLLM 동시 4개 · 자동 재시작). 요약 프롬프트에 「본문 문장을 그대로 옮기지 말 것」 보강 — 지금 47건이 본문을 옮김
- 서버 실행: 시험 실행 → 3,435건 본문 지우기 → `refine` → 48건 다시 요약 → 지우기
- EC2 `collector.env` 에 JUSO · SGIS 키 (사람이 넣는다)
