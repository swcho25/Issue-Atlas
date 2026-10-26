# contracts/ — 레인 간 계약의 단일 원본

PRD v4.1 의 계약을 여기에 둔다. 계약을 바꾸는 MR 은 양쪽 담당의 리뷰를 받는다.

| 계약 | 내용 | 주는 쪽 → 받는 쪽 | 기한 |
| --- | --- | --- | --- |
| [C1](c1/) | 공통 메타 필드(PRD 7.1) — JSON Schema · v0.2 기사 칸 초안(수신 측 리뷰 대기) | 수집(P1) → 정제·지역·시간·분류(P2~P4) | 10/23 v0.1 동결 · v0.2 리뷰 중 |
| [P2](p2/) | 정제 레코드(C1 + P2 칸) — JSON Schema, 저장 테이블 `normalized_record` · `normalized_ready` 뷰, 에어코리아 월별 표 `air_monthly` — v0.4 초안 | 정제(P2) → 지역·시간·분류(P3·P4) | — |
| [기사](article/) | 기사 본문 수집 결과 — 저장 테이블 `news_article` · `news_article_ready` 뷰 — v0.1 초안 | 본문 수집(P2) → 요약·분류(P3·P4) | — |
| [C2](c2/) | API 응답(논증 카드 6칸 · 근거 · 관측점) — OpenAPI · v0.1 초안 | backend(P7) → frontend(S1·S2·S4) | 10/30 v0.1 · 11/13 v1 |
| C3 | card_revision(수정 제안·승인) | 검수 화면 ↔ 되쓰기 | W3 |

공통 HTTP 오류 응답: [v0.2 초안](http-errors/) — C2 통합 전 frontend 리뷰 필요.

수집·지역 DB 기반: [v0.1 초안](database/) — 기반 6개 테이블, P1·P3 리뷰 필요.
