# infra/frontend-cicd — Cloudflare Workers 프론트 배포 및 CI/CD 구축

- Jira: S15P31C108-109
- 기준: origin/develop 63c3f61. Next.js SSR은 Cloudflare Workers에 배포하고 Spring API는 기존 EC2·Tunnel을 사용한다.

## 완료 조건

- [x] 현재 Next.js 버전·기능의 Workers 호환성을 확인하고 SSR 지원 배포 구성을 마련한다.
- [ ] 서비스 도메인·서버 전용 API 주소를 연결하고 실제 배포에서 화면·SSR·API 통신을 확인한다.
- [ ] develop/main 대상 MR에서 프론트 검사와 Workers 빌드를 수행한다.
- [ ] 보호된 develop/main 병합 후 CI 성공 시 자동 배포하며 인증정보는 저장소·클라이언트 번들에 포함하지 않는다.
- [ ] 필요한 검사와 첫 배포를 검증하고 설정·운영 방법·미검증 항목을 기록한다.

## 진행

- 2026-10-27: 사용자 제공 이슈 109 재사용. 최신 원격 develop에서 infra/frontend-cicd 생성. 기존 pnpm 실행 도구 메타정보 변경은 before-109-pnpm-tool-metadata stash에 별도 보관했다. Jira 도구가 없어 상태 전이는 수행하지 않았다. 구현·외부 설정·배포는 아직 시작하지 않았다.
- 2026-10-27: 사용자가 Cloudflare 이메일 인증·토큰 발급 후 GitLab CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN 등록 완료를 알렸다. 값은 읽거나 저장소에 넣지 않았다. OpenNext 1.20.13의 Next peer 범위가 현재 16.4.2를 포함함을 확인하고 Wrangler 4.153.0과 함께 고정했다. self-hosted GitLab을 지원하지 않는 Workers Builds 대신 기존 GitLab Runner로 구성했다.
- Workers 설정·빌드 wrapper·캐시하지 않는 /healthz·배포 점검 스크립트 추가. MR에서는 native 검사와 Workers 빌드·dry-run만, 보호된 develop/main에서만 공유 Worker 배포. 빌드 artifact를 그대로 사용하고 backend-deploy 성공 후 revision·HTML·API health를 점검한다.
- 최초 Windows 빌드는 Next 빌드 후 심볼릭 링크 EPERM으로 중단됐다. 로컬 Docker Desktop도 실행 중이 아니어서 켜거나 설정을 바꾸지 않았다. EC2에서 기존 서비스와 분리된 임시 컨테이너(메모리 3GB·CPU 1개, loopback 18787, 비밀 파일 미포함)로 CI와 같은 Linux Node 이미지를 사용해 검증했다.
- 기존 cacheComponents/partialPrefetching=true에서 workerd HTML/SSR 요청이 500·hang으로 실패했다. OpenNext 이슈 #1450 및 아직 Open인 PR #1318과 증상이 일치한다. Workers 빌드에서만 두 최적화를 끄고 Next 버전·SSR·일반 개발 설정은 유지했다. 이후 루트 HTML, /healthz, 실제 backend Tunnel 경유 /api/actuator/health 모두 200. 별도 사본에만 만든 SSR probe에서 요청 헤더 a/b가 HTML에 개별 반영되는 것을 확인했고 검증 화면은 제거했다.
- pnpm check 통과(프론트 lint/typecheck/단위 9건). native 브라우저 E2E 2건 통과(기존 랜딩+신규 상태 경로). 실제 Workers 미리보기 브라우저에서도 기존 랜딩 문구와 ‘서버 정상’ 표시 확인. 배포 점검 스크립트도 Worker 응답에 대해 PASS. 실제 Cloudflare 공개 배포와 첫 CD는 아직 수행하지 않았다.
- Workers용 Playwright 설정을 추가해 같은 화면·상태 검사 2건을 Linux workerd에서도 통과했다(12.3초). MR frontend-worker에도 해당 검사를 연결했다. 검증 probe가 없는 최종 빌드·배포 dry-run PASS, 압축 Worker 약 1.02MiB·artifact 전체 26MiB. .next를 제외한 별도 컨테이너에서도 .open-next만으로 배포 명령 dry-run PASS를 확인했다.
- 최종 pnpm check 재통과(프론트 lint/typecheck/단위 9건). pnpm check:all은 harness·backend format·프론트 전체(단위 9건/E2E 2건)까지 통과한 뒤 로컬 Docker Desktop 미실행으로 backend build에서 중단됐다. 엔진 검사는 전체 검사 순서상 실행되지 않았다. 전체 검사 통과로 기록하지 않는다. 백엔드·수집 로직은 변경하지 않았다.
- 임시 EC2 컨테이너·소스/의존성 사본·전달 압축파일, 로컬 SSH 포워딩·압축파일·실패한 Windows Worker 생성물과 검증 탭을 정리했다. 기존 backend HTTPS health 200 UP 재확인. YAML·job script 타입·배포 보호 조건·artifact 의존성·diff 검사 PASS. pnpm이 추가한 실행 도구 메타정보만 제거하고 실제 OpenNext/Wrangler 의존성 변경은 잠금 파일에 유지했다.

## 다음 할 일 / 범위 밖

- 첫 공개 배포에서 Cloudflare 계정·토큰 권한·Custom Domain·HTTPS 및 GitLab CD를 확인한다. push·병합은 사용자 수행이다.
- Workers에서 캐시 최적화를 비활성화한 호환성 차이를 프론트 담당자가 확인해야 한다. 공식 수정 반영 후 재활성화와 ISR/use cache 저장소는 별도 검증한다.
- 로그인·관리자 화면 등 제품 기능 구현, 수집·정제 로직, EC2 서비스 재배포는 제외한다. 인증·세션 연동은 해당 프론트 기능 구현 후 추가 검증한다.
- CI/CD는 병합 후 배포하며 MR 생성만으로 공개 서비스 버전을 바꾸지 않는다. 커밋·push는 아직 하지 않았다.
- 실제 Cloudflare 공개 배포·도메인 TLS·첫 GitLab CD 검증은 사용자 push/MR/병합 후 진행한다. 로컬 Docker Desktop을 켠 뒤 pnpm check:all 재실행이 필요하다.
