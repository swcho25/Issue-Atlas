# feat/collector-responses-mode — 서버 실행 명령에 기존 대응 추출 추가

- Jira: S15P31C108-170 · 앞선 작업: S15P31C108-136(!72) · 묶음/단위: P8

## 완료 조건
- [x] `issueatlas-collect responses` 가 `python -m pipeline.responses --db` 를 돌린다(결과 파일 없음, 수집과 같은 잠금)
- [x] 실행기 테스트 · 수동 실행 문서
- [x] 개발 서버에서 youth-policy · lofin · refine 뒤 `responses` 실행, 후보 수와 재실행 0건 확인(서버 권한 필요)

## 진행
- 2026-11-01: 이미지는 `engine/pipeline` 전체를 담아 Dockerfile 은 그대로. !72 위에서 시작했다(병합 전에는 이 MR 에 -136 커밋이 같이 보인다)

- 2026-11-03: 개발 서버 실행(이미지 b866720). 재료 온통청년 정제 5,633 · 세출 38,849. 첫 실행 후보 670 추가(C1/youthcenter 43 · C1/lofin 487 · A3/lofin 140), 다시 실행 0 추가 · 670 그대로. 여수 C1 124 · A3 18

## 다음 할 일 / 범위 밖
- ~~세출 엑셀 업로드 여부 확인 후 개발 서버 적재~~ — 개발 DB 에 이미 적재됨(38,849행)
- 후보가 논증 카드 ③ 「기존 대응」 근거가 되려면 출처 등급(youthcenter · lofin)이 있어야 한다. 지금은 null
