# feat/server-refine-runner — 서버 실행 명령에 온통청년 · 빅카인즈 수집과 P2 정제 추가

- Jira: (박준우 요청 — 기존 S15P31C108-121 · 101 · 155 후속) · 묶음/단위: P1 · P7

## 완료 조건
- [x] `issueatlas-collect` 에 `youth-policy` · `bigkinds` · `refine` 명령을 더한다
- [x] `refine` 에는 `--output` 을 붙이지 않는다(정제 CLI 는 `--db` 하나만 받는다). 수집과 같은 잠금을 쓴다
- [x] 온통청년 · 빅카인즈 수집기가 서버 실행기가 붙이는 `--output` 을 받는다(저장한 C1 레코드의 JSONL 사본)

## 진행
- 2026-10-30: 박준우 요청. 실행기에 세 모드와 `NO_OUTPUT = {"refine"}`, 인자 조립을 `run_arguments` 로 빼서 테스트. 잠금(run.lock)은 모든 모드가 같이 쓴다
- 2026-10-30: 수집기 이미지에서 확인 — youth_policy · bigkinds `--help` 에 `--output`, `pipeline.refine --output …` 은 사용법 오류(그래서 붙이지 않는다)
- 2026-10-30: !66 · !67 머지 뒤 develop 파이프라인 253033 · 253104 에서 collector-deploy 성공 — 서버 수집기 이미지는 이미 그 뒤 버전

## 다음 할 일 / 범위 밖
- 머지 · 배포 뒤 서버에서 실제 적재(조석원 · 서버 권한): `youth-policy` → `bigkinds --start … --until …` → `refine`
