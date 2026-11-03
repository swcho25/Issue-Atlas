# refactor/sigungu-place-id-kr — 시군구 place_id plc_ → kr- 전환

- Jira: 미정(Atlassian 인증 전, 「[P7] place_id plc_ → kr- 전환」) · PRD: 7.6 · 묶음/단위: P7 · 마감 11/05

## 완료 조건
- [x] V0024 가 시군구 6곳을 `kr-<KOSIS 새 시군구 5자리>` 로 바꾸고, 참조(`place.parent_id` · `place_code_map` · `card_evidence_status` · `existing_response` · `question` · 저장된 실행 결과)를 함께 옮긴다
- [x] API 테스트 · C2 · AI 예시가 새 ID, 저장소에 시군구 `plc_` 가 남지 않는다(옛 마이그레이션 제외)
- [x] 옛 ID 행을 넣은 DB 에 V0024 를 적용해 참조가 모두 옮겨지는 것을 확인
- [ ] 측정소 22곳 `plc_stn_*` 형식 — 정우현 제안 !104(S15P31C108-198, `kr-<시군구>-s<코드>`)로 넘김. 마이그레이션은 11/6 데모 뒤 그쪽 MR

## 진행
- 2026-11-02: 측정소 ID 형식은 정우현 확인 뒤로 미루고 시군구 6곳만 한다(사용자 결정)
- 2026-11-02: backend main 코드 · frontend 에는 시군구 ID 하드코딩이 없다. 바뀌는 곳은 마이그레이션 · 테스트 · 계약 예시
- 2026-11-02: 로컬 PostGIS 의 임시 DB 에 V0001–V0023 + 옛 ID 행(card_evidence_status · question · argument_run) → V0024 적용, 모두 kr- 로 옮겨짐 확인 후 임시 DB 삭제
- 2026-11-02: engine `tests_postgres/test_responses_store.py` 는 V0011 까지만 적용하는 스키마라 옛 ID 그대로 둔다

## 다음 할 일 / 범위 밖
- 측정소 `plc_stn_*` → kr- 형식(정우현과 P3 지역표 맞춤)
- 개발 DB 적용 뒤 `GET /v1/places` 가 kr- ID 를 주는지 확인, 화면 팀에 새 ID 알림
