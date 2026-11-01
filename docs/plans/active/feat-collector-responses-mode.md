# feat/collector-responses-mode — 서버 실행 명령에 기존 대응 추출 추가

- Jira: 미정(Atlassian 인증 전) · 앞선 작업: S15P31C108-136(!72) · 묶음/단위: P8

## 완료 조건
- [x] `issueatlas-collect responses` 가 `python -m pipeline.responses --db` 를 돌린다(결과 파일 없음, 수집과 같은 잠금)
- [x] 실행기 테스트 · 수동 실행 문서
- [ ] 개발 서버에서 youth-policy · lofin · refine 뒤 `responses` 실행, 후보 수와 재실행 0건 확인(서버 권한 필요)

## 진행
- 2026-11-01: 이미지는 `engine/pipeline` 전체를 담아 Dockerfile 은 그대로. !72 위에서 시작했다(병합 전에는 이 MR 에 -136 커밋이 같이 보인다)

## 다음 할 일 / 범위 밖
- 세출 엑셀 업로드 여부 확인 후 개발 서버 적재
