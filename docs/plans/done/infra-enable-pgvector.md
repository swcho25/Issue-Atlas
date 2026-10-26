# infra/enable-pgvector — pgvector 확장 활성화

- Jira: S15P31C108-104 · PRD: · 묶음/단위:

## 완료 조건
- [x] Flyway 마이그레이션 적용 후 `pg_extension`에 `vector`가 확인된다.
- [x] 로컬 DB와 백엔드 통합 테스트 DB에서 마이그레이션이 성공한다.
- [x] 벡터 칼럼·인덱스는 추가하지 않는다.

## 진행
- 2026-10-26: 시작
- 2026-10-26: PostGIS digest와 pgvector 0.8.7 소스 커밋을 고정한 DB 이미지를 로컬·배포·Testcontainers에 연결하고 Flyway V0006 추가.
- 2026-10-26: `pnpm check`(backend format·test, engine lint·test 220건)와 `pnpm backend:build` 통과. 로컬 Compose DB의 Flyway `0006:true`·`vector:0.8.7` 확인.
- 2026-10-26: `pnpm check:all` 통과(harness, frontend lint·typecheck·test 9건·e2e 1건, backend build, engine lint·test 220건).

## 다음 할 일 / 범위 밖
- 벡터 칼럼과 인덱스는 별도 작업에서 추가한다.
- EC2의 기존 DB 볼륨으로 새 이미지를 빌드·재기동하는 검증은 배포 시 수행한다.
