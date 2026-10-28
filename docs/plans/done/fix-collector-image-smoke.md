# fix/collector-image-smoke — 수집기 이미지 CI 점검을 지금 SP01 범위로

- Jira: S15P31C108-110 (후속 수정) · 묶음/단위: P1
- 기준: origin/develop 765036c, 2026-10-28

## 완료 조건
- [x] 수집기 이미지 CI 점검이 지금 SP01(월별) 실제 원천 예시로 통과한다(로컬 이미지 빌드 · 같은 명령 exit 0)
- [x] 기본 표가 다시 바뀌면 engine 테스트가 먼저 깨진다(CI 명령 · 예시 파일 대조 테스트)

## 진행
- 2026-10-28: !42 머지 뒤 develop 파이프라인 246891 의 collector-image 가 `KOSIS_INVALID_ROW` 로 실패, collector-deploy 건너뜀. 원인: !36(-110)에서 기본 SP01 을 월별로 바꿨는데 CI 점검은 예전 연간 20–24세 예시(kosis-net-migration.json)를 씀.
- 로컬 DB 의 실제 SP01 원천 행(여수 2023, 36행)을 contracts/c1/examples/raw/kosis-sp01-monthly.json 으로 저장. CI · deploy/collector README 명령을 이 파일로 바꿈. 로컬에서 engine/Dockerfile 이미지로 새 명령 exit 0, 예전 명령 exit 1(재현) 확인.

## 다음 할 일 / 범위 밖
- 머지 뒤 develop 파이프라인의 collector-image · collector-deploy 성공 확인
