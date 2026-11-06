# feat/card-list-live-evidence — 카드 목록 근거 상태를 고를 때마다 바로 센다

- Jira: S15P31C108-281 · PRD: — · 묶음/단위: P5 (「오류」 페이지 결정 1)

## 완료 조건
- [x] `GET /v1/places/{place_id}/cards` 가 근거 4종 상태를 질문 실행과 같은 규칙(저장하지 않는 `CardEvidenceStatus`)으로 고를 때마다 센다
- [x] 같은 지역 · 기간 · 카드 판이면 카드 목록 상태 = 실행 근거 수요표 상태 (통합 테스트 `cardListCountsEvidenceLiveWithoutSavingAndMatchesTheRun`)
- [x] 수동 등록 상태(card_evidence_status)가 먼저, 카드 목록 조회는 근거 행을 만들지 않는다
- [x] contracts/c2/README 「카드 목록 구현」 설명 갱신 (칸 그대로)

## 진행
- 2026-11-06: 시작. 규칙(`CardEvidenceStatus.resolve`)과 고르기 SQL(`EvidenceMatchSql`)을 card 패키지에 두고 질문 실행 · 카드 목록이 같이 쓴다. question → card 방향만 있어 순환 없음
- 2026-11-06: `pnpm check`(backend format · test) · backend build 통과. 개발 DB 읽기 전용 SQL 로 확인 — 여수 2023–2025 C1 · A3 모두 4/4(통계 available · 보도자료 8 · 기존 대응 115 · 18 · 분모 1), 최근 실행 근거 수요표와 같다. 카드 2개 약 0.8초(첫 조회 2.5초, 보도자료 제목 검색이 대부분)

## 다음 할 일 / 범위 밖
- 카드 목록에는 「비교 조건 4가지 충족」 칸이 없다 — 화면이 쓰려면 C2 v1 에서 칸 추가(연 값 계산이 필요해 SQL 만으로는 안 됨)
- 보도자료 제목 검색(strpos)이 첫 조회 1.7초 — 카드가 늘면 normalized_ready 제목 trigram 인덱스 검토
- `QuestionService` 의 `KINDS` 와 `CardEvidenceStatus.KINDS` 가 같은 목록 — 다음에 질문 실행 코드를 고칠 때 하나로
