# feat/article-card-tags — 기사 카드 꼬리표를 분류 결과로 채우기

- Jira: S15P31C108-215 (상위 S15P31C108-161) · PRD: — · 묶음/단위: P4

## 완료 조건
- [x] V0036 이 observation view 의 기사 행 tags 를 document_card_score.selected 카드로 채운다 (칸·순서, 통계·대기 행은 V0031 그대로)
- [x] 활성 기사 벡터 + 활성 카드 프로필로 계산된 점수만 쓴다. 점수 없음·기준 미달·옛 입력/옛 카드 판 점수는 빈 배열 (ObservationViewTest)
- [x] C1 으로 선택된 기사는 C1 질문의 articles[] 에 나오고 A3 질문에는 안 나온다 (backend 테스트)
- [x] contracts/observation README 의 「기사 tags 빈 배열」 설명을 바꾼다
- [x] 로컬 DB 에 적용해 여수·광주 C1·A3 기사 건수를 확인한다 (화면 확인은 사용자 결정으로 뺌: 응답 `articles[]` 칸은 그대로라 화면이 생기면 그대로 읽고, 지금 develop 프론트에는 기사 화면이 없다)

## 진행
- 2026-11-03: 시작. Jira 하위 작업 생성·진행 중 전이, origin/develop 에서 브랜치 생성
- 2026-11-03: V0036 은 V0031 view 를 그대로 다시 정의하고 기사 행 tags 만 바꿨다(diff 로 확인). 활성 기사 입력 · 활성 카드 프로필 · 같은 모델의 `selected` 점수만 읽어, 요약이나 카드 프로필이 바뀐 뒤 `score` 를 다시 돌리기 전의 옛 점수는 쓰지 않는다
- 2026-11-03: ObservationViewTest(활성 · 옛 입력 · 옛 카드 판 · 기준 미달 · 점수 없음 5가지)와 QuestionApiTest(C1 기사 → C1 질문 articles 1건, A3 질문 0건) 추가. `pnpm check` 통과
- 2026-11-03: 격리 로컬 DB(issue_atlas_p4, 기사 100 · 점수 200)에 V0035 → V0036 적용. view 기사 태그 51건 = 점수 selected 51건(C1 21 · A3 30, 둘 다 1). 여수 `kr-12130` C1 5 · A3 2, 광주 `kr-29` C1 2 · A3 8
- 2026-11-03: 계약 문서 갱신 — observation v0.4, 기사·카드 검색(화면 응답 줄), 동결 문서의 기사 카드 태그 줄
- 2026-11-03: `pnpm check:all` 9개 항목 통과. 열린 원격 브랜치 중 V0036 이상을 쓰는 곳 없음

## 다음 할 일 / 범위 밖
- 개발 서버에서 `embed-docs` · `embed-cards` · `score --apply` 를 돌린 뒤에야 개발 DB 의 `articles[]` 가 찬다(이 MR 은 view 만 바꾼다)
- 기준값은 AI 초안 라벨로 정한 임시값(`thresholds.json` ai-draft-v1). 사람 라벨 검토 뒤 바꾸고 `score` 만 다시 돌린다
- 지도 기사 점 화면은 프론트 레인 작업이다(응답 `articles[]` 칸은 동결 그대로)
