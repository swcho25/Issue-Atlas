# feat/question-rate-limit — 익명 질문 요청 수 제한

- Jira: S15P31C108-208 후속(일반 사용자 API 공개) · !133 최동준 리뷰 「LLM 문장화 연결 전에 최소한의 제한」

## 완료 조건
- [x] POST `/v1/questions` 가 IP 당 분당 한도(기본 10, `QUESTIONS_PER_MINUTE`)를 넘으면 429 `TOO_MANY_REQUESTS` problem+json · `Retry-After: 60`
- [x] IP 는 `CF-Connecting-IP`, 없으면 접속 주소. 다른 IP 는 따로 센다
- [x] 공통 오류 계약 v0.3 에 429 추가
- [x] 다른 API 테스트는 그대로 돈다(테스트 설정만 한도를 크게)

## 진행
- 2026-11-04: 서버 한 대라 메모리 고정 1분 창. 백엔드 포트는 호스트 127.0.0.1 에만 열려(deploy/dev/compose.yaml) 밖에서는 Tunnel 로만 닿아 CF 헤더를 믿는다

## 다음 할 일 / 범위 밖
- 서버를 늘리면 공용 저장소(Redis 등)로
- 한도 값은 문장화(GMS) 붙인 뒤 실제 토큰 사용량을 보고 다시 정한다
