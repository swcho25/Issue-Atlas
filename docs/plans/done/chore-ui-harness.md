# chore/ui-harness — 디자인 세팅을 하네스로(lint 센서 · Tailwind 설정 안내 · ui 스킬)

- Jira: S15P31C108-235 · PRD: — · 묶음/단위: 화면 공통 세팅

## 완료 조건
- [x] `className` 의 직접 색(`-[#…]`) · 글자 크기(`text-[13px]`) · 그림자(`shadow-[…]`) · 숫자 겹침 순서(`z-10`), `style` 의 `#…` 색을 ESLint 가 고치는 방법과 함께 막는다. 토큰 계산값 · 크기는 막지 않는다
- [x] 에이전트가 Tailwind 설정 파일(`src/app/styles/globals.css`)을 찾고 먼저 읽는다: 파일 맨 위 목차, `frontend/AGENTS.md` · 루트 `AGENTS.md` 안내, `tailwind.config.js` 를 만들지 않는다는 규칙
- [x] `ui` 스킬(원본 `.agents/skills/ui` + Claude 연결)에 Figma 화면 · 컴포넌트를 만드는 순서(읽기 → 토큰으로 → 견본 → 자동 대조 → 확인)가 있다
- [x] 루트 `AGENTS.md` 폴더 표에 `docs/design/` · `ui` 스킬

## 진행
- 2026-11-04: 시작. 사용자 요청 「세팅했던 것을 하네스로 쓰게」 + 「테일윈드 설정 파일도 보게」
- 2026-11-04: ESLint `no-restricted-syntax` 5종(className 문자열 · 템플릿, style 리터럴). 시험 파일에 잘못 쓴 6줄 → 6개 모두 오류, 허용 줄(토큰 · `calc(…var(--u))` · `h-[68px]` · `var(--map-region)`) → 0개. 기존 코드 위반 0. globals.css 맨 위에 「이 파일이 Tailwind 설정」 목차. `pnpm check` 통과
- 2026-11-04: 마무리. Jira S15P31C108-235 생성(에픽 61 개발 환경·하네스). `pnpm check:all` 9개 통과

## 다음 할 일 / 범위 밖
- `shared/ui/README.md` 컴포넌트 목록은 버튼(U6)을 만들 때
- 센서는 className · style 에 바로 쓴 값만 본다. 상수 · 배열에 담아 넘긴 클래스 문자열은 못 본다(반복되면 그때 넓힌다)
