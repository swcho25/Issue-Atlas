# fix/result-observation-order-name — 「확산형」 이름을 「관측 순서」로

- Jira: S15P31C108-284 · PRD: §5 금지 표현 · 묶음/단위: 결과 화면 04 (11/01 대표 결정 표 1 #5)

## 완료 조건
- [x] 04 지도 유형 전환 칸 「확산형」 → 「관측 순서」(칸 폭 안에 들어감)
- [x] 프론트 코드(이름 · 주석)와 디자인 문서 · 내 계획 파일에서 「확산」 「전파」 단어가 없다
- [x] contracts · backend · engine 에 남은 같은 단어는 목록으로 남겨 담당에게 넘긴다

## 진행
- 2026-11-06: 시작. 사용자가 11/01 대표 결정 표를 붙여 줘서 확인 — #5 「확산」 그림은 「관측 순서」로, 화면 · 코드 · 문서에서 「확산」 「전파」 제거

- 2026-11-06: 바꿈 — 유형 전환 칸 「확산형」 → 「관측 순서」(앱 글꼴 Bold 12 로 44.1, 칸 77 안), 키 `spread` → `observationOrder`, 주석 2곳(views.ts · shared/api/c2/argument.ts), DESIGN.md 2줄, 내 M1 계획 파일 2줄. 판단 배지 글자(「증가」)는 그대로 두기로(사용자). develop 에 로그인 필수가 들어와 결과 화면은 로그인 뒤에만 열림 — 브라우저 확인은 로그인 뒤
- contracts · backend · engine 에 남은 「확산」(담당 리뷰 필요, 이번엔 안 바꿈): `contracts/c2/README.md`(그림 줄 표 「확산」, 83줄은 금지 문구 목록), `contracts/c2/schemas/argument.schema.json`(series 설명 「기사 건수(확산)」), `backend/.../question/dto/ArgumentResponse.java`, `backend/.../question/service/SeriesService.java`, `contracts/cards/*` · `contracts/c3/*` · `contracts/ai/README.md` · `engine/ai/argument/prompt.py` · 테스트들(금지 문구 목록일 수 있음 — 담당 확인)

- 2026-11-06: 브라우저 확인(로그인 뒤, 1600 × 900): 유형 전환 「분포형 · 변화형 · 이동형 · 관측 순서 · 사건형」, 「관측 순서」 칸 x 748 · 폭 77 안에 들어감, 화면에 「확산」 없음. `pnpm check` 통과. 처음엔 로그인이 안 됨 — 목 서버 프록시가 dev 응답의 Set-Cookie(XSRF-TOKEN · JSESSIONID)를 빼먹어 로그인이 403 → 목 서버가 쿠키를 넘기게 로컬에서 고침(목 서버의 임시 순유출 양수 블록과 같은 파일이라 이 커밋에는 넣지 않음)
- 2026-11-06: 마무리. Jira S15P31C108-284. `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- 목 서버 프록시 쿠키 전달(로그인 필수 화면을 목 서버로 볼 때 필요) — 따로 작은 수정으로
- 로그인하면 /ask(새 질문, 호성 담당)로 가는데 아직 404
- 관측 순서 그림을 만들 때 고정 문구 「첫 관측 순서, 옮겨 간 경로·원인 아님」
