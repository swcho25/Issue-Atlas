# docs/landing-scroll-prototype — 랜딩 스크롤 시제품(지구 → 구름 → 광주 지도)

- Jira: 미정 · PRD: - · 묶음/단위: -

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] `node docs/design/landing-scroll/serve.js docs/design/landing-scroll 5199` 로 시제품이 열린다
- [x] 2026-11-02 시제품 수정 이력이 요청 단위 커밋으로 남아 있다(대화 기록에서 되살려 최종본과 대조함)
- [x] 무엇을 왜 바꿨고 무엇을 버렸는지 `docs/design/landing-scroll/README.md` 에 정리돼 있다
- [ ] 실제 랜딩(`frontend/src/pages/landing`)에 옮길 범위를 정한다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-11-02: 임시 폴더에서 14단계로 고친 시제품을 이 브랜치로 옮김. 수정 이력은 대화 기록의 파일 수정(Write · Edit · sed)을 순서대로 다시 적용해 요청 단위로 커밋했고, 마지막 상태가 원본과 같음을 확인함

## 다음 할 일 / 범위 밖
- 실제 랜딩 코드 반영: 지구 사진 나눠 받기 · 석상 미리 굽기 · 끌기 부드럽게(지금 `globe.ts`·`statue.ts` 는 8K 전체 사진과 석상 계산을 그대로 씀)
- 지도 제공처 · 라이선스 결정(S15P31C108-94) — 시제품은 OpenFreeMap liberty 를 구워 씀
- 측정소 좌표 · PM2.5 값은 예시 → 실제 값으로
