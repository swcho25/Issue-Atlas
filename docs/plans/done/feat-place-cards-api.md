# feat/place-cards-api — 지역별 이슈 카드와 근거 확보 상태 조회

- Jira: S15P31C108-132 · PRD: C2 place-cards · 묶음/단위: P7

## 완료 조건
- [x] Flyway로 카드 표를 만들고 C1·A3 카드를 넣는다.
- [x] GET /v1/places/{place_id}/cards가 기간별 근거 4종 상태와 available_kinds를 C2 모양으로 돌려준다.
- [x] 점수·순위 없이 대분류 → 가나다로 정렬한다.
- [x] 실제 PostGIS 통합 테스트로 미수집·상태 집계·지역/기간 격리·입력 오류를 검증한다.

## 진행
- 2026-10-29: origin/develop 31bf886에서 별도 worktree·feat/place-cards-api 시작. 기존 !45·!48 브랜치를 수정하지 않는다.
- 2026-10-29: 카드 메타는 C2 예시의 C1·A3만 사용한다. 카드별 지역·기간 근거 연결은 아직 없으므로 원본의 존재만으로 available을 추측하지 않는다. 정확히 같은 조회 기간에 기록된 근거 상태를 읽고, 미등록은 not_collected. P3/P4 상태 작성 연결은 후속 범위다.
- 2026-10-29: 최신 카드 명세 Notion은 연결에서 404. 사용자 완료 조건·현재 C2 계약을 기준으로 구현하며 판단 규칙/필수 근거 정의는 만들지 않는다.
- 2026-10-29: 통합 테스트가 근거 종류 조인 누락(확보 수 4배)을 발견해 s.kind = k.kind로 수정. 400/404·인증·중복 제약 검증 포함. 실제 HTTP 응답 C2 JSON Schema 검증 통과.
- 2026-10-29: 열려 있는 !45의 V0011, refactor/drop-news-article의 V0012와 충돌하지 않도록 카드 테이블은 V0013 사용.
- 2026-10-29: `E2E_PORT=63837 pnpm check:all` 전체 PASS: 하네스·backend format/build·PostGIS 테스트 47개(신규 6개)·frontend lint/typecheck·단위 9개·Chromium E2E 2개·engine lint 및 pytest 340개. 실제 응답 `backend/build/c2-place-cards-response.json`은 jsonschema Draft202012 + FormatChecker로 C2 place-cards 통과.

## 다음 할 일 / 범위 밖
- !45의 지역 6곳 seed가 병합되면 실제 지역 ID로 연결 확인. 현재 테스트는 격리된 place를 사용한다.
- 병합 순서: !45(V0011)와 기사 표 정리(V0012)를 먼저 반영하고 이 브랜치에 develop을 받아 재검증한 뒤 V0013을 배포한다. V0013을 먼저 적용한 DB에 더 작은 버전을 뒤늦게 넣지 않는다.
- P3/P4에서 card_evidence_status에 기간별 확정 상태를 기록하는 연결 및 카드 명세 승인. 이 구현은 근거 자동 분류·충실도 계산을 하지 않는다.
- 133의 충실도 미결 4가지, 135 측정소 적재, 136 원본 확보는 별도.
- 서버·사용자 로컬 DB 변경 없음. 테스트는 Testcontainers DB에서만 수행한다.
