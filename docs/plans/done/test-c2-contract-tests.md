# test/c2-contract-tests — API 계약 테스트 자동화 (FR-J1)

- Jira: S15P31C108-158 · PRD: FR-J1 「Swagger 문서와 계약 테스트」 · 인수 기준 6 · 묶음/단위: P7 (L2)

## 완료 조건
- [x] 백엔드 테스트가 API 응답을 C2 JSON 스키마로 검증한다 (지역 · 카드 목록 · 근거 · 지도 점 · 수집 이력)
- [x] C2 예시 파일 전체를 CI 에서 스키마로 검증한다
- [x] 계약과 다른 응답이면 MR 파이프라인이 실패한다

## 진행
- 2026-10-30: 테스트 전용 의존성 com.networknt:json-schema-validator 1.5.6(Jackson 2, 이미 테스트 클래스패스에 있음). C2Contract 가 스키마 $id 주소를 contracts/c2/schemas 파일로 잇고 format 도 검사한다
- 2026-10-30: API 테스트 5개(지역 · 카드 목록 · 근거 · 지도 점 · 수집 이력)의 성공 응답 11곳에 C2Contract.matches 를 붙였다. C2ExamplesTest 가 예시 11개를 이름이 가장 길게 겹치는 스키마로 검사하고, 계약에 없는 칸 · 규칙표와 다른 등급은 실패하는지 본다
- 2026-10-30: 확인 — 지도 점 응답의 geometry_role 을 일부러 바꾸니 ObservationApiTest 가 실패했다(되돌림). backend 테스트는 MR 파이프라인에서 돌므로 계약과 다르면 MR 이 막힌다

## 다음 할 일 / 범위 밖
- !59 출처 목록 API 가 머지되면 SourceApiTest 에도 C2Contract.matches("source-list") 를 붙인다
- 질문 · 논증 카드 API(133)가 생기면 argument · question 응답도 같은 방식으로
