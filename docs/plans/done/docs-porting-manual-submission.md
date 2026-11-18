# docs/porting-manual-submission — 최종 제출 자료 정리

- Jira: S15P31C108-350 · PRD: 해당 없음 · 묶음/단위: 최종 발표 준비

## 완료 조건

- [x] `exec/`에 포팅 매뉴얼, 운영 DB 덤프, 시연 시나리오 ZIP이 있다.
- [x] 덤프는 Git LFS 포인터로 추적되고 원본 아카이브 목록을 읽을 수 있다.
- [x] 세 파일의 복사본 해시가 원본과 일치한다.

## 진행

- 2026-11-18: 제출용 브랜치를 `origin/develop`에서 분리하고 세 파일을 준비했다.
- 2026-11-18: ZIP 목록, 파일 SHA256, pg_restore 목록과 Git LFS 포인터를 확인했다. `node scripts/check.mjs`는 코드 변경 없음으로 통과했다.

## 다음 할 일 / 범위 밖

- MR 병합과 제출은 리뷰 후 진행한다.
