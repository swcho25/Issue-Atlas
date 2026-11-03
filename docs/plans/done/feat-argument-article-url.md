# feat/argument-article-url — 근거 기사 원문 링크 · C1 예시 연령

- Jira: 미정(「[P7] C2 근거 기사 원문 링크 추가」, Atlassian MCP 인증 뒤 생성) · 기준: 5차 멘토링 회의록 표 3 데모 4번(근거 기사 2클릭 → 원문) · 표 1 결정 2(C1 청년 19–39세) · 앞선 작업: !82

## 완료 조건
- [x] argument 응답 `articles[]` 에 `url`(빅카인즈 원본 레코드 `document.link`, 없으면 null)이 실리고 C2 스키마가 검사한다
- [x] 기사마다 원문 링크를 찾는 조회가 인덱스를 탄다(V0029)
- [x] C2 · AI 예시의 C1 연령 문구가 카드 계약대로 19–39세다
- [ ] C2 받는 쪽(화면팀) · AI 계약 담당 리뷰 — 받지 못한 채 병합(!89). 칸은 11/4 동결 문서(!97, 정우현 리뷰)에 포함

## 진행
- 2026-11-02: 시작. 링크는 news_event 에 없고 normalized_record.record.document.link 에만 있다. 인덱스 없이 기사 한 건당 약 0.1초(로컬 1만 행)라 V0029 로 news_id 식 인덱스를 더한다

## 다음 할 일 / 범위 밖
- observation view 의 기사 tags 가 늘 비어 있어 articles 는 아직 빈 배열이다. 11/6 데모 3번(기사 점)에 기사 카드 태그가 필요하다(기사 분류 P4 · 최동준)
- 여수 C1 판정: C1 규칙(표 1 결정 2) 구현 + 통계 확보 상태(card_evidence_status) 채우기
