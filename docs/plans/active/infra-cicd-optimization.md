# infra/cicd-optimization — 변경 영역에 따른 CI/CD 실행 범위 최적화

- Jira: S15P31C108-113 · PRD: 해당 없음 (배포 기반 개선)

## 완료 조건
- [ ] MR 및 develop/main 병합 후 변경 파일에 따라 필요한 검사·빌드·배포만 실행한다. FE만 변경하면 BE·수집기를 재배포하지 않는다.
- [x] 공통 계약·의존성·배포 설정 변경은 실제 영향받는 구성 요소를 포함하고, 여러 영역 변경 시 필요한 작업을 모두 실행한다.
- [ ] 선택적으로 생략되는 job 때문에 파이프라인이 생성 실패하지 않으며, BE와 다른 서비스가 함께 배포될 때 필요한 선행 배포 순서를 유지한다.
- [x] FE 단독·BE 단독·수집기 단독·복합·공통 설정·문서 전용·파일 삭제/이름 변경 시나리오의 실행 job을 로컬에서 검증하고 운영 문서를 갱신한다.
- [x] 기존 보호 브랜치·CI 통과 조건·이미지 digest·배포 직렬화·배포 후 검증을 유지하고, 변경 영역 검사 및 MR 전 전체 검사를 통과한다.

## 진행
- 2026-10-27: 작업 트리가 깨끗한 것을 확인하고 최신 origin/develop (ba5a380)에서 브랜치를 생성했다.
- 현재 develop/main 병합 후 FE·BE·수집기 이미지와 배포가 모두 실행된다. frontend-deploy와 collector-deploy는 backend-deploy를 필수 선행 작업으로 지정한다.
- 수집기 이미지는 engine/pipeline, engine 의존성 파일 및 contracts를 포함하므로 engine 검사 범위와 수집기 배포 범위를 구분해 확인한다.
- 변경 경로를 changes.gitlab-ci.yml에서 공유하고 검사·이미지·배포에 적용했다. engine API/테스트 변경은 engine 검사만 수행한다. backend-deploy는 FE·수집기의 optional 의존성으로 바꾸되 존재하면 성공을 기다린다. harness·infra는 MR과 push 모두 명시적으로 실행한다.
- 배포 테스트 29건 PASS. 새 선택 검사 5건은 develop/main의 경로별 시나리오, MR 배포 금지, 보호 변수 조건, 필수 artifact·선행 단계 의존성을 확인했다. YAML 해석용 PyYAML 6.0.3을 infra job에 고정했다. 후속 MR 문서 전용 조건 추가 후 선택 검사 5건 재통과.
- pnpm check PASS (애플리케이션 변경 없음), pnpm check:all PASS (harness, BE 포맷·빌드, FE lint·타입·단위 9건·E2E 2건, engine lint·270건). 최초 제한 환경의 pnpm 네트워크/테스트 임시 폴더 접근 실패는 정상 권한 재실행으로 통과했다. 서버 변경·배포·push는 수행하지 않았다.

## 다음 할 일 / 범위 밖
- 사용자 push 후 GitLab CI Lint/MR 파이프라인과 병합 후 파이프라인 생성·성공을 확인한다. 로컬 선택 검사는 GitLab 서버 검증을 대체하지 않는다. 실제 확인 전 첫째·셋째 완료 조건은 남겨 둔다.
- 이번 MR은 공통 CI 변경이므로 전체 실행이 정상이다. 이후 서비스 단독 변경에서 무관한 job 생략과 소요 시간을 확인한다. 실패한 과거 배포는 해당 job을 재시도해야 하며 무관한 후속 변경이 재배포하지 않는다.
- FE 배포에 기존 pnpm store 캐시를 연결했다. Runner 캐시 실제 적중·시간 단축은 GitLab에서 확인한다. 실제 검증 완료 후 이 계획을 done으로 이동한다.
- 애플리케이션·수집기 처리 로직, 로컬 pre-push 검사 규칙, 수집 스케줄은 변경하지 않는다. Runner 동시 실행 수 증가는 이번 범위에서 제외한다.
