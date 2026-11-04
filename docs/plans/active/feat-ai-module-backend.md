# feat/ai-module-backend — 논증 문장화 engine API와 질문 실행 연결

- Jira: S15P31C108-231 (상위 S15P31C108-162) · PRD: — · 묶음/단위: P4 · P5

## 완료 조건

- [ ] AI 계약 v0.2: 문장화 요청·결과 스키마, 사유 코드, 시간 제한을 `contracts/ai` 에 정하고 예시가 스키마 검사를 통과한다
- [ ] engine `POST /v1/argument/phrase` 가 요청을 계약으로 검사해 문장화 결과를 돌려준다(어기면 `INPUT_INVALID`) — 가짜 모델 API 테스트
- [ ] backend 질문 실행이 판정된 실행에서 engine 을 불러 ③·⑤ 를 채우고, 꺼짐·오류·시간 초과·검사 탈락이면 카드 문구·빈 반박으로 응답하며 사유를 `argument_phrasing` 에 남긴다 — 통합 테스트(가짜 engine)
- [ ] 로컬에서 engine + backend 를 띄워 실제 GMS 로 C1·A3 질문을 실행하고 `GET /v1/arguments` 응답을 브라우저로 확인한다
- [ ] `pnpm check:all` 통과

## 진행

- 2026-11-04: 시작. 결정: 연결은 (가) engine HTTP 서비스를 backend 가 질문 실행 때 부름, 실제 기사 요약 GMS 전송 허용, 서버 배포(engine 컨테이너 · deploy_backend.py · CI)는 다음 MR(인프라 조석원 리뷰), 시험 자료는 개발 DB 덤프를 로컬 별도 DB 로, 출처 등급은 담당 팀원 작업(오늘 중) 전까지 로컬 시험 DB 에만 임시로 넣는다(커밋 안 함).
  확인: 서버 배포에 engine 서비스 없음, 로컬 `issue_atlas` 는 V6 · `issue_atlas_p4` 는 기사 100건뿐(통계 관측 0), `source.reliability_grade` 를 넣는 마이그레이션 없음 → 등급이 없으면 통계 근거가 안 생겨 실행이 `blocked`.

## 다음 할 일 / 범위 밖

- 서버 배포 MR: engine Dockerfile 에 `api` 복사 · 실행 명령, `deploy/dev` compose 에 engine 서비스(GMS 키 env 파일), `deploy_backend.py` 의 구성 요소, CI 경로 규칙. 인프라 담당 리뷰
