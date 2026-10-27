# 프론트 Workers 배포 — S15P31C108-109

Next.js는 Cloudflare Workers, Spring은 기존 EC2·Tunnel에서 실행한다. GitLab CI가 배포하며 Cloudflare의 저장소 자동 연결은 사용하지 않는다.

## 설정과 실행

- `frontend/wrangler.json`: Worker `issueatlas-frontend`, 서비스 주소 `https://issue-atlas.kr`, API 주소 `https://backend.issue-atlas.kr`. 별도 workers.dev·preview URL은 공개하지 않는다. 계정 ID·인증 토큰은 포함하지 않는다.
- `/api/*`는 기존 Next rewrites로 Spring에 전달된다. Workers 빌드는 rewrites와 런타임 vars에 같은 API 주소를 사용한다. API 주소 변경 시 다시 빌드·배포한다.
- GitLab 변수 `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`: Variable·Protected·범위 `*`, 토큰만 Masked, Expand variable reference 해제. 토큰은 해당 계정과 issue-atlas.kr로 범위를 제한한다.
- 개발: `pnpm frontend:dev`. Workers 빌드: `pnpm --filter frontend worker:build`. 미리보기: `pnpm --filter frontend worker:preview` (8787). Workers 빌드·미리보기는 Linux/WSL 사용을 권장한다. Windows에서는 심볼릭 링크 권한 오류가 날 수 있다.
- OpenNext가 루트와 프론트의 `.env*`를 번들에 포함할 수 있어 실제 `.env` 파일이 있으면 빌드를 거절한다. 비밀을 이동·삭제하지 말고 CI처럼 비밀 파일 없는 작업 사본에서 빌드한다. 실행 설정은 Wrangler vars/secrets로 관리한다.

## CI/CD

1. develop/main 대상 MR: 기존 프론트 검사·E2E와 `frontend-worker`의 Workers 빌드·Wrangler dry-run·Workers 브라우저 검사. 같은 E2E를 Node와 workerd에서 각각 실행한다. API 토큰 없이 실행하며 공개 버전을 바꾸지 않는다.
2. 보호된 develop/main 병합: FE에 영향이 있는 변경일 때 선행 검사 후 빌드한 `.open-next`를 artifact로 전달한다. BE도 변경되었다면 `frontend-deploy`는 backend 배포 성공을 기다리고, 아니면 기존 BE를 사용한다. 경로별 실행 조건은 [CI 운영 문서](../ci/README.md#변경-영역-선택-s15p31c108-113)를 참고한다.
3. `shared-workers` 환경과 `issueatlas-workers` resource group에서 같은 Worker로 배포한다. GitLab의 오래된 배포 방지 설정도 유지한다. Cloudflare token은 배포 job에만 사용한다.
4. 배포 시 커밋 SHA를 `DEPLOYMENT_REVISION`으로 설정한다. `/healthz`의 SHA·루트 HTML·`/api/actuator/health`를 확인하고 불일치/오류면 job을 실패시킨다. 배포 후 점검 실패 시 자동 원복은 구현하지 않았으므로 GitLab/Workers 배포 이력을 확인한 뒤 이전 정상 버전을 복구한다.

첫 배포가 Worker와 Custom Domain 연결을 만든다. `issue-atlas.kr`에 충돌하는 DNS 레코드가 있으면 먼저 대시보드에서 확인하며, 기존 backend Tunnel 레코드를 변경하지 않는다. 계정 ID·토큰·도메인 권한·실제 첫 CD는 사용자 병합 후 검증한다. 이 토큰은 유효기간이 있으므로 만료 전에 갱신한다.

## 호환성과 남은 검증

- 로컬 프론트 lint/typecheck/단위 9건, Node E2E 2건, Linux Workers E2E 2건, 실제 backend API 프록시·SSR 요청 구분·배포 dry-run·배포 후 점검 스크립트 검증을 통과했다. 전체 `pnpm check:all`은 로컬 Docker 미실행으로 backend build에서 중단됐으므로 전체 통과로 기록하지 않는다. 임시 컨테이너·검증 사본·SSR probe는 정리했다.
- Next.js 16.4.2, OpenNext 1.20.13, Wrangler 4.153.0을 고정한다. 의존성·잠금 파일은 함께 커밋한다.
- [OpenNext #1450](https://github.com/opennextjs/opennextjs-cloudflare/issues/1450), [수정 PR #1318](https://github.com/opennextjs/opennextjs-cloudflare/pull/1318): 현재 Cache Components staged rendering이 workerd에서 멈출 수 있다. 실제 미리보기에서도 HTML 요청이 500으로 실패했다. `ISSUEATLAS_WORKERS_BUILD=1`인 Workers 빌드에서만 cacheComponents·partialPrefetching을 끈다. 일반 로컬 개발은 기존 설정을 유지하며 SSR·서버 컴포넌트는 유지한다. 공식 수정 반영 후 별도 검증을 거쳐 재활성화한다.
- 현재 ISR/`use cache`를 사용하는 제품 기능은 없으며 영속 캐시를 구성하지 않았다. 해당 기능 추가 시 캐시 저장소·무효화·사용자별 응답 격리를 먼저 설계한다. SSR을 정적 export로 바꾸지 않는다.
- 현재 랜딩은 원래 정적 사전 생성 대상이다. SSR 지원은 별도의 일회용 검증 화면에서 요청 헤더가 HTML에 반영되는지 확인하며, 이 화면을 제품에 추가하지 않는다.
- 로그인 화면·사용자별 SSR·세션 쿠키·CSRF 연동·Swagger 쓰기 호출은 기능 구현 후 별도 검증한다. 백엔드·수집기 코드와 배포 설정은 변경하지 않는다.
