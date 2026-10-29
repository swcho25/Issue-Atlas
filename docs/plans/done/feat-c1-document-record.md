# feat/c1-document-record — C1 v0.2 문서 레코드 칸 추가

- Jira: S15P31C108-100 · PRD: v4.1 7.1·7.5 · 묶음/단위: P1

## 완료 조건
- [x] contracts/c1 스키마·예시·README에 문서 칸을 추가하고 기존 관측값 예시가 통과한다.
- [x] 빅카인즈 합성 예시 1건이 스키마를 통과한다. 실제 수집으로 오인하지 않게 표시한다.
- [x] 박준우 요청(2026-10-28) 반영: document 에 원문 링크(link) · 본문 수집 결과(fetch: status 8종 · http_status · fetched_at · fetcher) · 본문(body). 본문이 있으면 full, 없으면 metadata 를 스키마가 검사한다.
- [x] P2(박준우)·P3(정우현)·P4(최동준) 리뷰를 받는다 — !41 머지(2026-10-28)

## 진행
- 2026-10-26: develop pull --ff-only 결과 최신. S15P31C108-100 재사용, 작업 브랜치 생성. 기업 계약 전 뉴스 API를 호출하지 않는다.
- 2026-10-26: document 내부에 제목·발행 기관·분류·키워드·개체명·excerpt 추가. 발행 시각·링크는 공통 필드 재사용. 뉴스 본문과 full 저장 금지, 기존 관측값 조건 유지.
- 2026-10-26: pnpm check 통과(engine lint, pytest 226건), 문서/관측값 경계 테스트 13건 포함. git diff --check 통과. 기존 예시 5개 변경 없음.
- 2026-10-28: develop(9d7d5e1) 위로 다시 올림(contracts/README 충돌 해결). 박준우 요청으로 link · fetch · body 추가, `full` 금지 → 「본문 있으면 full」. raw_url 은 받아 온 곳(빅카인즈 API), 원문 주소는 document.link, locator 는 news_id. engine pytest 전부 통과.
- P2 확인: 예시를 refine_records 에 넣으면 이용허락 표(BIGKINDS → metadata)로 scope 가 metadata 로 바뀌는데 body 는 남는다 → C1 규칙(metadata 면 body 없음)과 어긋남. P2 이용허락 표·본문 지우기는 박준우 쪽 결정.

## 다음 할 일 / 범위 밖
- 수신 측 리뷰는 미완료. 계약 초안을 확정 또는 병합 완료로 표시하지 않는다.
- 빅카인즈 실연동은 S15P31C108-101(다음 작업). P2 문서 저장 범위·금지 출처 해제는 박준우와 계약 확인 후 협의.
- 본문 저장(full) 자체는 팀·멘토 확인 전(박준우가 공유). 보도자료(press_release, -100 이전 별도 표)는 C1 문서로 옮기지 않았다.
