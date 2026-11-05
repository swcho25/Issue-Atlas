# infra/cicd-build-optimization — CI/CD 실행 조건 및 FE 설치·빌드 최적화

- Jira: S15P31C108-151

## 완료 조건
- [x] 설명 MD 변경은 서비스 배포를 유발하지 않고, 실행 계약 변경은 소비자 검사와 필요한 수집기 배포를 유지한다.
- [x] FE 공통 도구 반복 설치를 줄이고 배포는 같은 파이프라인의 검증된 Worker artifact를 사용한다.
- [x] Node/Workers 설정 차이를 보존하고 변경 선택·의존성 검사 및 필요한 FE 검증을 통과한다.

## 진행
- 2026-10-30: 최신 origin/develop에서 브랜치 생성. contracts MD는 설명, C2 JSON은 BE 테스트, C1 JSON은 수집기 실행/이미지 smoke test에서 사용함을 확인.
- 2026-10-30: Node 빌드는 Cache Components 활성, Workers 빌드는 비활성이라 두 빌드를 무조건 공유할 수 없음. 동일 설정 결과만 재사용한다.
- 2026-10-30: FE 3개 job을 공식 Playwright 1.64.1 amd64 이미지(digest 고정)로 통일. apt·브라우저 반복 설치 제거, 배포 pnpm 캐시는 pull 전용, Next 캐시는 Node/Workers·환경별 분리. 기존 .open-next artifact 재사용 유지.
- 2026-10-30: 변경 선택·배포 회귀 37건 통과. 새 이미지의 Node 24.22.1/Git/Corepack/Chromium 확인. 비밀 없는 Linux 사본에서 FE lint/typecheck/단위 12건·Node E2E 2건·개발/운영 Workers 빌드/dry-run/E2E 각 2건 통과. 검증 컨테이너와 소스 tar 정리.
- 2026-10-30: pnpm check:all 전체 통과(harness·BE format/build/통합 테스트·FE lint/typecheck/단위/E2E·engine lint/354건). git diff --check 통과. 실제 GitLab 속도·배포 검증은 미수행.

## 다음 할 일 / 범위 밖
- Runner 병렬 실행·자원 제한·자동 취소는 후속 작업. 커밋·푸시·MR은 사용자 수행.
- 실제 GitLab 실행 시간 감소와 병합 후 배포는 사용자 push 이후 확인한다.
