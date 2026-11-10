# feat/evidence-api — 근거 상세 API (원문 탭 · 각주 복사)

- Jira: S15P31C108-134 · PRD: 8장 API ④ · FR-E1 · E2 · E4 · E5 · 묶음/단위: P7 (L2)

## 완료 조건
- [x] GET /v1/evidence/{evidence_id} 가 출처 등급 · 시점 · 이용 조건 · 저장 범위 · 원문 URL 을 돌려준다
- [x] storage_scope 가 link_only 면 표시 내용(display)을 null 로 준다 (DB CHECK 로도 막는다)
- [x] 각주 문자열(출처명 · 자료명 · 시점 · 등급 · URL · 조회일)을 함께 준다
- [x] 실제 근거로 확인한다 — 근거를 만드는 질문 실행(S15P31C108-133) 뒤 — 2026-11-05 개발 서버: 통계 근거 KOSIS A · full · 각주, 보도자료 근거 B · metadata · 원문 링크

## 진행
- 2026-10-29: 시작. Flyway V0014 로 evidence 표. 번호는 열린 MR 의 V0011(!45) · V0012(!49) · V0013(!51) 다음
- 2026-10-29: 근거 하나 = 한 행, 원본 여러 건을 묶을 수 있다(C2 예시처럼 KOSIS 3년치 → 1건). 출처 등급 · 이용허락 · 저장 범위는 근거를 만든 때의 값을 둔다(재현성). 출처 이름은 source 표에서 읽는다
- 2026-10-29: 각주는 API 가 만든다. 기간 [start, end) 는 끝을 빼고 연 「2023–2025」 · 월 「2024-06」 · 그 밖 날짜, 시점 자료는 한국 날짜, URL 없으면 그 칸을 뺀다. 조회일은 collected_at 의 한국 날짜
- 2026-10-29: EvidenceApiTest 4건 PASS. 실제 응답 3개를 ajv 로 C2 evidence 스키마 검증 → valid
- 2026-10-29: develop(!45 · !49 · !50 · !51 머지)을 받아 DB 계약 이력 충돌 정리(v0.1.10). EvidenceApiTest 도 테스트마다 되돌리게(@Transactional, !54 와 같은 이유). V0011–V0014 함께 전체 backend 57건 PASS

## 다음 할 일 / 범위 밖
- 근거를 채우는 쪽은 질문 실행(133). 근거 ↔ 원본 레코드(raw_record.content_hash) 연결 표는 133 에서 필요하면 더한다
- 135 지도 점의 임시 evidence_id(ev_air_<측정소>_<YYYYMM>)를 이 표의 ID 로 바꾸기
- 확인 필요: C2 예시 각주는 자료명 뒤에 통계표 ID 를 붙인다(「…이동자수(DT_1B26001)」). 지금은 title 그대로 쓴다. 필요하면 근거를 만들 때 title 에 넣는다
- 시각은 UTC(…Z)로 나간다. 계약은 오프셋 있는 ISO 8601 이라 맞지만 예시는 +09:00
