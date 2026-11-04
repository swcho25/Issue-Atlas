# refactor/drop-press-release-table — 옛 보도자료 표를 다 옮긴 DB 에서만 지운다

- Jira: S15P31C108-240 · PRD: — · 묶음/단위: P1 · P2

## 완료 조건
- [x] Flyway 마이그레이션이 옛 표의 모든 행이 원본 장부에 있을 때만 `press_release` 를 지우고, 하나라도 없으면 표를 남기고 알림만 남긴다
- [x] 수집기 `press --from-table` 은 운영 DB 이전용으로 남기고, 옛 표가 지워진 DB 에서는 `PRESS_OLD_TABLE_GONE` 으로 실패한 실행을 남긴다
- [x] 계약 · README 에서 옛 표 · `--from-table` 설명을 정리한다
- [x] 개발 서버에 지우기 전 백업 파일이 있다 (`/home/ubuntu/backup/press_release-20261104.csv.gz`, 11,559행)
- [x] backend · engine 테스트와 `pnpm check:all` 이 통과한다

## 진행
- 2026-11-04: 시작. 검수 API 는 -237(V0043, 조석원)로 정제 행을 가리켜 옛 표를 안 읽는다. 개발 DB 옛 표 11,559건(광주 6,852 · 여수 4,707) 모두 원본 장부에 있음(payload `press_id`). 지우기 전 개발 서버에 CSV 백업
- 2026-11-04: 처음엔 `--from-table` 을 빼려 했으나 남긴다. 운영 DB(main 10/30 이후 미반영)는 옛 표가 유일한 사본일 수 있고 광주 누리집은 자동 요청을 막아, V0044 가 표를 남긴 DB 에서는 이 경로로 옮겨야 한다
- 2026-11-04: `PressReviewMigrationTest` 의 `DROP TABLE press_release` 는 V0044 뒤라 `IF EXISTS` 로. engine `test_press_store` 에 조건부 삭제 · 지운 뒤 `--from-table` 시험 추가(6개 통과)

## 다음 할 일 / 범위 밖
- develop → main 반영 때 운영 배포 로그에서 V0044 알림(`press_release 를 남긴다`)이 나왔는지 보고, 나왔으면 운영에서 `press --site gwangju|yeosu --db --from-table` → 새 마이그레이션으로 지우고 `--from-table` 경로도 뺀다
