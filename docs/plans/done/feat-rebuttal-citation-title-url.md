# feat/rebuttal-citation-title-url — 반박 근거 기사 모달 추가(인용 제목 · 원문 링크)

- Jira: S15P31C108-343 · PRD: — · 묶음/단위: P5 (논증 엔진)
- !245(반박 인용 응답, 머지됨)의 보강. 결과 화면 시안 D(「근거 N」 → 인용 모달, 원문은 새 탭)로 정하면서 모달이 근거 상세를 따로 받지 않고 기사 제목을 보이고 원문을 새 탭으로 열 수 있게 인용에 `title` · `url` 을 싣는다.

## 완료 조건
- [x] C2 `rebuttals[].citations[]` 에 `title` · `url`(못 찾으면 null) — 스키마 · C2 README · 동결 문서
- [x] backend 가 인용 기사 원본 레코드의 제목 · 언론사 링크를 채운다. 출처 등급이 없어 근거 행을 못 만든 기사도 제목 · 링크는 채운다 (backend 테스트)
- [x] 결과 화면 ⑤ 「해당 자료 있음」 줄에 「근거 N ›」 버튼 → 인용 모달(시안 D: 제목 · 인용문 · 날짜, 같은 인용문 전재 기사 묶기, 원문은 새 탭) (frontend 테스트)
- [x] 로컬에서 실제 질문 결과로 모달을 브라우저에서 확인
- [x] `pnpm check:all` 통과

## 진행
- 2026-11-11: 시작. `QuestionRepository.citedArticles`(근거 행 만들기 + `LEFT JOIN evidence` 로 제목 · 링크 · 근거 ID), `Citation.withSource`, `QuestionService.withCitationEvidence` 가 세 값을 채운다. 질문 API 테스트에 제목 · 링크 · 원본 없는 기사 null 확인 추가. QuestionApiTest 46 · C2Examples · OpenApiContract · Architecture 통과.
- 2026-11-11: `pnpm check:all` 통과(harness · backend format · frontend lint · typecheck · test · e2e · backend build(test 포함) · engine lint · test).
- 2026-11-11: 프론트 — zod `rebuttals[].citations`(title · url · evidence_id 는 nullish: 앞 판 응답도 통과), `model/citations.groupCitations`(같은 인용문 묶기 · 가장 이른 날짜 · 링크 있는 기사), `RebuttalCitations`(「근거 N ›」 버튼 + `<dialog>` 모달, 수정 제안 모달과 같은 규격), `ArgumentTab` ⑤ 줄에 연결. 버튼은 사용자 의견으로 › 아이콘 · 옅은 앰버 바탕. 테스트 4개.
- 2026-11-11: 로컬(DB 사본 · engine · backend · frontend) 여수 C1 실제 실행: 「근거 2 ›」 → 모달에 동아일보 「한 해에 1000명 이주… 낡은 여수산단 사택 떠나는 직원들」 · KBS 「협약에 특강까지 하는데…석유화학 불황에 지역 채용 절벽」, 원문 새 탭(noopener), 모달 중 뒤 화면 막힘, Esc 로 닫으면 초점이 버튼으로. 콘솔 오류 없음. `pnpm check:all` 다시 통과(테스트 고정값 readonly 타입 오류 하나 고침).
- 2026-11-11: 마무리. 커밋을 계약 · backend · 프론트(스키마 · 묶기 · 모달 · 연결)로 나눠 MR.

## 다음 할 일 / 범위 밖
- 결과 화면 담당(UHyeonJ) · 디자이너 리뷰, Figma 반영
- 빅카인즈 원본 링크에 `&amp;` 가 섞인 기사가 있다(예 KBS `…ncd=8134226&amp;ref=DA`). 원본 값이라 그대로 둠
