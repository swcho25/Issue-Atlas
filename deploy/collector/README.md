# 수집기 EC2 배포 — S15P31C108-105

수집기는 상시 서비스가 아니다. CD는 사용 버전만 바꾸고 실제 수집은 운영자가 실행한다. cron·RabbitMQ·FastAPI 배포와 P1/P2 로직 변경은 포함하지 않는다.

## 자동 배포

- develop/main 대상 MR은 기존 검사만 수행한다. 보호된 develop/main에 병합하면 검사 후 `collector-image` → `collector-deploy`가 실행된다. collector-deploy는 backend-deploy 성공도 기다려 Flyway 적용 전에 새 수집기 버전을 선택하지 않게 한다.
- 기존 비공개 저장소 `swcho25/issueatlas-backend`에 `collector-$CI_COMMIT_SHA` 태그로 업로드한다. 백엔드는 기존 SHA 태그를 유지한다. 실제 사용 버전은 태그가 아닌 digest다.
- 이미지의 project·revision·component=collector를 확인한다. backend 이미지를 collector로, collector 이미지를 backend로 배포할 수 없다.
- CD는 네트워크·설정 파일·DB 연결 없이 도움말 실행으로 이미지 로딩을 검사하고 `/opt/issueatlas-dev/.deploy/collector/current.json`을 원자적으로 갱신한다. API를 호출하거나 데이터를 수집하지 않는다.
- 실패하면 이전 사용 버전을 유지한다. 실제 수집 중 CD가 실행돼도 이미 시작한 작업은 원래 digest로 끝나며 다음 실행부터 새 버전을 사용한다.
- 기존 SSH 전용 키·보호 변수·shared-ec2 환경을 재사용한다. 서버 처리기는 backend/collector만 허용한다. Collector의 배포 이력·watermark는 backend와 별도로 보관하고 배포 잠금/resource group은 공유한다.

CI 전용 Docker를 같이 운영하는 EC2에서는 서비스 bridge의 외부 통신 규칙도 유지해야 한다. `deploy/ci/runner/restore-service-egress.sh`를 root:root 755로 `/usr/local/sbin/issueatlas-service-egress`에 설치한다. CI Docker unit의 ExecStartPost가 서비스 subnet의 외부 접속과 해당 응답만 DOCKER-USER에 복원한다. 기본 방화벽 정책·외부 공개 포트를 바꾸지 않으며 반복 실행해도 규칙을 중복 추가하지 않는다.

## 최초 서버 준비

서버 관리자가 아래 경로를 준비한다. 키와 실제 설정은 저장소에 넣지 않는다.

| 경로 | 내용·권한 |
| --- | --- |
| `/etc/issueatlas/collector.env` | `.env.example`에 적힌 DB·API 설정. UID/GID 10001, 400. 이미지의 `/app/.env`에 읽기 전용 연결 |
| `/var/lib/issueatlas/collector/input` | XLSX 등 입력 자료. UID/GID 10001, 750. 컨테이너 `/inputs`에 읽기 전용 연결 |
| `/var/lib/issueatlas/collector/output` | 실행별 C1 결과. UID/GID 10001, 750. `/app/outputs`에 연결 |
| `/var/log/issueatlas/collector` | 실행별 로그·사용 이미지·종료 코드. root 700, 개별 파일 600 |
| `/opt/issueatlas-dev/deploy/collector/compose.yaml` | 이 폴더의 Compose. root 소유이며 기존 issueatlas-dev_default 네트워크에 연결 |
| `/usr/local/sbin/issueatlas-collect` | run_collector.py를 root:root 755로 설치. 수동 실행과 잠금·로그 담당 |

기존 `/usr/local/sbin/issueatlas-deploy.py`를 이 브랜치의 `deploy/ci/deploy_backend.py`로 갱신하고 `/etc/issueatlas/cicd.json`에 `collector_image_repository`를 추가한다. 기존 backend 설정은 유지한다. Dockerfile은 저장소 루트에서 `docker build -f engine/Dockerfile .`로 빌드한다. Python 기반 이미지·uv·의존성은 고정하고 API 키·개발 의존성은 포함하지 않는다.

`POSTGRES_HOST=postgres`, 포트 5432로 기존 DB에 연결한다. collector.env에는 관리자 로그인 비밀번호나 Tunnel 토큰을 넣지 않는다. API 키를 로그·명령 인자·GitLab 이미지 빌드 변수에 넣지 않는다.

수집기는 UID 10001, 읽기 전용 파일 시스템, CPU 1개분·메모리 1GB·PID 128 한도로 실행된다. 수집 잠금은 세 모드에 공통이며 다른 수집이 실행 중이면 두 번째 실행은 거절한다. 실패 로그와 결과 파일은 삭제하지 않는다. 로그/결과 보관 기간과 디스크 정리는 운영자가 관리한다.

## 수동 실행

첫 collector CD 성공 후 실행한다. CLI 기본 기간을 운영 일정으로 간주하지 말고 담당자와 확인한 범위를 명시한다.

```bash
# KOSIS: 처음에는 작은 범위로 수집. 같은 spec_id의 기존 사양과 범위가 다르면 거절된다.
sudo issueatlas-collect kosis --regions 46130 --start-year 2023 --end-year 2025 --spec-id SP01

# 에어코리아 측정소 API. /etc/issueatlas/collector.env의 AIRKOREA_SERVICE_KEY 필요.
sudo issueatlas-collect airkorea-stations

# 담당자가 확인한 최종확정 XLSX를 input에 넣고 컨테이너 경로로 지정한다.
sudo issueatlas-collect airkorea-final --xlsx /inputs/final.xlsx --start-date 2024-01-01 --end-date 2024-01-02

# 키·네트워크·DB 쓰기 없이 이미지 안의 예제로 실행 환경 확인
sudo issueatlas-collect kosis --fixture /app/contracts/c1/examples/raw/kosis-sp01-monthly.json --export-only --regions 46130 --start-year 2023 --end-year 2023

sudo cat /opt/issueatlas-dev/.deploy/collector/current.json
sudo ls -lt /var/log/issueatlas/collector
```

실행 결과에는 로그·결과 폴더 경로와 종료 코드가 나온다. `exit_code=0`이어야 성공이며, export-only 성공은 실제 API/DB 저장 성공이 아니다. 재실행해도 출력 폴더는 새로 만들고 DB 중복 처리는 수집기 기존 규칙을 따른다. schema는 Flyway만 관리한다.

## 현재 한계

- 2026-10-26: 검증 이미지로 EC2에서 KOSIS 여수 2023~2025 3건과 에어코리아 측정소 22건의 실제 API·DB 적재를 확인했다. 각각 재실행해 추가 저장 0건, 중복 3건/22건을 확인했다.
- 공공데이터포털 [최종확정 측정자료](https://www.data.go.kr/data/15122830/fileData.do)의 `한국환경공단_에어코리아_최종확정 측정자료_20241231.xlsx`로 2024-01-01 하루 3,168건을 적재했고, 재실행에서 추가 저장 0건·중복 3,168건을 확인했다. 12개월 시트명·열 구성은 기존 수집기와 일치한다. 수집 로직·원본 파일은 수정하지 않았다. 에어코리아에서 별도로 받은 `Data` 시트·`SO2` 등 짧은 열 이름의 월별 파일은 현재 수집기의 입력 형식과 다르다.
- 사용자 요청에 따라 위 검증에서 생성한 raw_record 3,193건·job_run 7건·검증 전용 KOSIS spec 1건과 C1 출력 폴더 7개를 정리했다. 삭제 대상 실행 ID를 고정하고 정제 결과의 참조가 없으며 다른 원본·실행 이력이 보존됨을 트랜잭션 안에서 확인했다. 공통 source/spec 정의와 입력 원본은 유지한다. 검증·정리 결과는 `/var/log/issueatlas/collector/xlsx-105-verification/`에 보관한다.
- 로컬·EC2의 임시 `issueatlas-collector:105-check` 이미지는 검증 후 삭제했다. 실제 운영 명령은 첫 collector CD로 정식 사용 버전을 등록한 뒤 실행한다.
- 최신 develop에는 P1의 c1_record 저장·입구 검사 수정이 반영되어 있다. 이 배포는 수집만 실행하며 DB 정제는 별도 작업이다.
- 브랜치 push·MR/병합 뒤 실제 collector 이미지 업로드·자동 갱신을 확인해야 CD 검증 완료다.
