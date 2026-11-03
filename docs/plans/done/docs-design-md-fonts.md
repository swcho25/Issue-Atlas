# docs/design-md-fonts — 한글 Pretendard · 영문 Gothic A1 글꼴 규칙

- Jira: S15P31C108-214 · PRD: — · 묶음/단위: 화면

## 완료 조건
- [x] `docs/design/DESIGN.md` Typography 에 네 글꼴의 쓰임(한글 · 문장부호 Pretendard, 영문 · 숫자 · 띄어쓰기 Gothic A1, 워드마크 Source Serif 4, 라벨 IBM Plex Mono)이 있다
- [x] 「한영 섞어 쓰기」에 맞춤 표(화면 굵기 → 쓰는 Gothic A1 파일 · size-adjust)와 웹 구현 예가 있다
- [x] 글자 스타일 토큰(YAML)의 글꼴이 Pretendard 다
- [x] 「Figma 와 맞출 것」에 IA5 글자 스타일이 아직 Gothic A1 인 이유가, 「Figma 보다 앞선 랜딩 결정」에 지금 히어로가 있다

## 진행
- 2026-11-03: 캔버스 비교 보드(이름표 글꼴 · 영문 굵기 · 한영 섞어 4종 · 균형)로 조합 결정. 1000px 에서 잰 값: Gothic A1 영문 대문자 높이 70 → 81%(굵기 따라), Pretendard 영문 71.9%. 랜딩 시제품(`docs/landing-scroll-prototype`, 커밋 bf89f0b)과 Figma 「00 · 로고 · 글꼴」 보드 카드에도 반영. 처음엔 머지된 `docs/design-md` 브랜치에 커밋했다가, 이미 머지 · 삭제된 브랜치라 develop 에서 새로 땀

## 다음 할 일 / 범위 밖
- Figma 글자 스타일 IA5/ 를 Pretendard 로 교체(Figma 에 Pretendard 설치 · 팀 글꼴 등록 필요)
- 프론트(next/font) 에 같은 글꼴 구성 적용
