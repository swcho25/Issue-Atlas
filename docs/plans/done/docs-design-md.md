# docs/design-md — Figma v5 기준 디자인 시스템 문서

- Jira: S15P31C108-207 · PRD: — · 묶음/단위: 화면

## 완료 조건
- [x] `docs/design/DESIGN.md` 에 Figma 「Design notes v5」 · 변수 IA v5(Light · Dark) · 글자 스타일 `IA5/` · v5 컴포넌트 값이 있다 (DESIGN.md 형식: 토큰 YAML + 쓰는 법)
- [x] 색 역할 · 다크 모드 · 글꼴 · 결과 화면 배치 · 유리 · 그림자 · 모서리 · 컴포넌트 · 할 것 / 하지 말 것이 있다
- [x] Figma 안에서 어긋난 곳과 Figma 보다 앞선 랜딩 결정이 따로 적혀 있다
- [x] 토큰 YAML 이 읽히고, 컴포넌트가 가리키는 토큰이 모두 있다

## 진행
- 2026-11-03: Figma 작업 파일(eLKq5xtPBVZCn50867JTVm)을 Plugin API 로 읽어 값 정리. 형식은 google-labs-code/design.md(alpha) — 공식 lint 는 따로 설치가 필요해 돌리지 않고, yaml 로 읽어 참조 · 제목 순서만 검사

## 다음 할 일 / 범위 밖
- 프론트 토큰(`frontend/src/app/styles`)과 이름 맞추기
- Figma 정리: 섹션 이름의 「해도 청록」, `Button/키 컬러` 설명, `Tone=Violet`, 변수에 안 묶인 값
