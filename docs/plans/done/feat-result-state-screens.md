# feat/result-state-screens — 결과 화면 불러오는 중 · 오류 · 없는 결과 상태 화면

- Jira: S15P31C108-328 · PRD: — · 묶음/단위: S1 · 단위 17(노션 로드맵 「화면 공통 컴포넌트 · 상태 화면」)

## 완료 조건
- [x] 결과(04 지도 · 05 탭)를 불러오는 동안 빈 화면 대신 카드 · 패널 모양 자리와 「결과를 불러오는 중이에요」가 보인다
- [x] 없는 결과(API 404)는 Next 기본 404 대신 「결과를 찾을 수 없어요」 카드(내 질문 보기 · 새 질문 만들기)
- [x] 그 밖의 오류(500 · 응답 형식 불일치)는 Next 기본 오류 대신 「결과를 불러오지 못했어요」 카드(다시 시도 · 내 질문으로), 오류 번호(digest)를 함께 적는다
- [x] 밝은 · 어두운 화면 모두 읽히고, 낭독기에 상태가 전해진다(role=status · alert)

## 진행
- 2026-11-10: 시작. 사용자 「A 진행하자」(금요일까지 할 일 정리 중 A).
  지금: `ResultPage` · `ResultDetailPage` 의 `<Suspense>` 에 fallback 이 없어 불러오는 동안 빈 화면, `getArgument` 가 404 면 `notFound()` 를 부르지만 `not-found` 파일이 없어 Next 기본 404, 그 밖의 오류는 `error` 파일이 없어 Next 기본 오류 화면.
  Figma 08 「상태 화면」: 근거 부족(blocked) · 카드 조건 밖(unsupported) · 비교 불가 · **실행 실패** · 권한 없음 · 원문 링크만. 불러오는 중 · 없는 결과 그림은 없음.
  `State / 실행 실패`(2374:7869)의 `Failed` 카드 720 × 190: 흰(surface/1) · 모서리 16 · 안쪽 22 · 24 · 20 · 24 · 칸 사이 14 · 그림자 0 4 12 + 0 2 4(shadow-md).
  머리(사이 12): 빨간 연한 원 36(status/red-soft) 안 경고 18(status/red) · 제목 Heading 20 「60초 안에 끝내지 못했어요」 · 이유 Caption 12 text-3.
  고를 것 두 칸(사이 12, 각 모서리 10 · 안쪽 14 · 16 · 사이 8): 「모인 근거로 결과 보기」 primary/soft + primary/line 테두리 · Label 13 primary/text + Caption 12 text-2, 「나중에 다시 실행」 surface/2 · Label 13 text-1 + Caption 12 text-2.
  Next 16.4 문서: `error.js` 는 Client Component, props `error` · `retry`(16.3 부터 안정). `not-found.js` 는 그 구간의 `notFound()` 를 받는다

- 2026-11-10: `ui/state`(StateCard · ResultError · ResultNotFound · ResultLoading), `ResultPage` · `ResultDetailPage` 의 Suspense fallback, `app/(app)/results/[id]/error.tsx` · `not-found.tsx`. 테스트 4, `pnpm check` 통과.
  겪은 문제: `error.tsx` 를 다시 내보내기만 하면(「use client」 없이) Next 가 「must be a Client Component」 로 막음(타입 · 린트 · 테스트는 통과해 브라우저에서야 보임) → 파일 맨 위에 「use client」. 슬라이스 index 를 그대로 가져와도 컴파일 · 응답 200.
  브라우저 확인은 dev 백엔드가 내려가 막힘: 10:10 쯤 /api 전체 nginx 502(그 사이 배포 없음, 09:54 배포 성공) → 10:30 새 배포로 살아났다가 10:32 쯤 다시 502. 로그인이 안 돼 결과 화면(로그인 필수)에 못 들어감

- 2026-11-10: dev 가 살아나 로그인 뒤 브라우저 확인(1600 × 900).
  없는 결과 `/results/run_does_not_exist`: 「결과를 찾을 수 없어요」 카드 720 × 172 · role=status · 내 질문 보기(/me/questions) · 새 질문 만들기(/ask) · 왼쪽 띠 그대로.
  오류 `/results/run_%20bad`(dev 400): 「결과를 불러오지 못했어요」 · role=alert · 오류 번호 4067015227 · 「다시 시도」 누름 → 다시 받아(RSC 요청) 같은 오류 카드 · 내 질문으로 링크.
  불러오는 중: 실제 실행(여수 C1 11/06) 04 · 05(evidence) 응답 HTML 에 자리 그림과 「결과를 불러오는 중이에요…」 가 먼저 흐른다(04 = 400 카드 자리, 05 = 본문 줄 + 368 패널 자리). 어두운 화면: 두 카드 글자 · 고를 칸 모두 읽힘(<html data-theme> 만 잠시 바꿈).
  **함께 고친 것 — 불러오는 중 동그라미가 네모로**: 04 자리 그림의 아이콘 원에 `rounded-full` 과 줄 모양의 `rounded-md` 가 함께 걸려 CSS 순서로 `rounded-md` 가 이겨 6px 네모(측정 border-radius 6px). 모서리를 줄(bar)에만 두고 원은 `rounded-full` 하나로 → 원. `pnpm check` 통과(테스트 52 파일 · 274)

- 2026-11-10: 마무리. develop(9c51fca) 위에서 `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- dev 백엔드 반복 다운은 배포 담당에게 알리기(남은 일 22)
