# 수집기 EC2 배포 — S15P31C108-105

수집기는 상시 서비스가 아니다. CD는 사용 버전만 바꾸고 실제 수집은 운영자가 실행한다. 개발 서버의 매일 예약 실행(251번)은 아래 「매일 예약 실행」에 있는 출처만 돈다. RabbitMQ·FastAPI 배포와 P1/P2 로직 변경은 포함하지 않는다.

## 자동 배포

- develop/main 대상 MR은 기존 검사만 수행한다. 보호된 develop/main에 병합하면 검사 후 `collector-image` → `collector-deploy`가 실행된다. collector-deploy는 backend-deploy 성공도 기다려 Flyway 적용 전에 새 수집기 버전을 선택하지 않게 한다.
- 기존 비공개 저장소 `swcho25/issueatlas-backend`에 `collector-$CI_COMMIT_SHA` 태그로 업로드한다. 백엔드는 기존 SHA 태그를 유지한다. 실제 사용 버전은 태그가 아닌 digest다.
- 이미지의 project·revision·component=collector를 확인한다. backend 이미지를 collector로, collector 이미지를 backend로 배포할 수 없다.
- CD는 네트워크·설정 파일·DB 연결 없이 도움말 실행으로 이미지 로딩을 검사하고 `/opt/issueatlas-dev/.deploy/collector/current.json`을 원자적으로 갱신한다. API를 호출하거나 데이터를 수집하지 않는다.
- 실패하면 이전 사용 버전을 유지한다. 실제 수집 중 CD가 실행돼도 이미 시작한 작업은 원래 digest로 끝나며 다음 실행부터 새 버전을 사용한다.
- SSH 전용 키는 유지하되 브랜치별 development/production 보호 변수 범위를 사용한다. 서버 처리기는 backend/collector/engine만 허용한다(engine 은 243번, 설정에 저장소가 있는 환경만). Collector의 배포 이력·watermark는 backend와 별도로 보관하고 배포 잠금/resource group은 같은 환경 안에서만 공유한다.

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
| `/usr/local/sbin/issueatlas-collect` | run_collector.py를 root:root 755로 설치. 수동 실행과 잠금·로그 담당. **CD 가 갱신하지 않는다** — 이 파일을 바꾸면 서버 관리자가 다시 설치한다 |

기존 `/usr/local/sbin/issueatlas-deploy.py`를 이 브랜치의 `deploy/ci/deploy_backend.py`로 갱신하고 `/etc/issueatlas/cicd.json`에 `collector_image_repository`를 추가한다. 기존 backend 설정은 유지한다. Dockerfile은 저장소 루트에서 `docker build -f engine/Dockerfile .`로 빌드한다. Python 기반 이미지·uv·의존성은 고정하고 API 키·개발 의존성은 포함하지 않는다.

`POSTGRES_HOST=postgres`, 포트 5432로 기존 DB에 연결한다. collector.env에는 관리자 로그인 비밀번호나 Tunnel 토큰을 넣지 않는다. API 키를 로그·명령 인자·GitLab 이미지 빌드 변수에 넣지 않는다.

수집기는 UID 10001, 읽기 전용 파일 시스템, CPU 1개분·메모리 1GB·PID 128 한도로 실행된다. 수집 잠금은 세 모드에 공통이며 다른 수집이 실행 중이면 두 번째 실행은 거절한다. 실패 로그와 결과 파일은 삭제하지 않는다. 로그/결과 보관 기간과 디스크 정리는 운영자가 관리한다.

## 환경 선택 (137번)

기본 실행은 기존 개발 환경이다. 운영은 **mode 앞에** `--environment main`을 지정한다: `sudo issueatlas-collect --environment main kosis ...`. 개발은 `--environment develop`이며 생략 가능하다. 서버 JSON에서 해당 환경의 배포 기록·DB 네트워크·비밀 파일·input/output/log 경로를 선택한다. 운영 DB 접속 정보는 별도 `/etc/issueatlas/production/collector.env`로 준비하고 개발 설정을 복사해 연결하지 않는다. 입력 파일은 환경별 input 경로에 서버 관리자가 배치한다.

## 수집 뒤 자동 정제

원본 장부(`raw_record`)에 쓰는 수집(kosis · airkorea-stations · airkorea-final · press · youth-policy · bigkinds)이 성공하면 실행기가 **같은 잠금 안에서** `refine --changed-since <수집 시작 시각>` 을 이어 돈다. 그 수집이 실행 이력(`job_run`)을 남긴 출처만 정제한다([P2 계약](../../contracts/p2/README.md) v0.10). DB 에 쓰지 않은 실행(예: `--db` 없는 press)은 정제할 출처가 없어 바로 끝난다. 수집 로그에 정제 출력이 이어 붙고, 요약 JSON 에 `refine_exit_code` 가 붙는다. 수집이 성공하고 정제가 실패하면 실행기 종료 코드는 정제의 코드다.

- `--no-refine`(mode 앞): 이어지는 정제를 끈다. 그 환경의 수집기 이미지에 `refine --changed-since` 가 없을 때(운영에 아직 반영 전) 쓴다: `sudo issueatlas-collect --environment main --no-refine kosis ...`
- 세출(lofin)은 자체 표라 정제하지 않는다. 기존 대응 후보(`responses`)는 지금처럼 따로 돌린다

## 매일 예약 실행 (S15P31C108-251, 개발만)

`issueatlas-collect-daily.timer` 가 매일 03:00 KST(04:00 DB 백업 전)에 [schedule/daily_collect.py](schedule/daily_collect.py)를 부른다. 스크립트는 단계마다 `issueatlas-collect --environment develop` 을 불러, 잠금 · 로그 · 수집 뒤 정제는 위 실행기 규칙 그대로다.

| 순서 | 단계 | 실행기 인자 | 걸리는 시간 |
| --- | --- | --- | --- |
| 1 | 여수 보도자료 최근 14일 | `press --site yeosu --db --start <14일 전> --end <오늘>` | 약 1–2분(게시판 1–2쪽 — 2026-11-05 첫 실행은 14일에 116건 · 2쪽, robots 30초 간격) + 정제 1분 |
| 2 | 온통청년 정책 | `youth-policy` | 약 1–2분 + 정제 |
| 3 | 기존 대응 후보 | `responses` — 2가 성공했을 때만 | 몇 초 |

- 한 단계가 실패해도 다음 독립 단계는 돈다. 하나라도 실패(또는 건너뜀)하면 unit 이 실패로 남는다: `systemctl status issueatlas-collect-daily` · `journalctl -u issueatlas-collect-daily`. 각 수집의 로그 경로는 실행기가 출력하는 JSON 에 있다
- 손으로 수집 중이면 실행기 잠금 때문에 그 단계는 실패한다. 다음 날 다시 돈다(`Persistent=true` 라 서버가 꺼져 있던 날은 켜질 때 한 번)
- 같은 글 · 같은 정책은 원본 장부에서 중복으로 세고 새 행을 만들지 않는다. 14일 창은 하루 이틀 빠져도 다음 실행이 채우는 폭이다

넣지 않은 출처:

| 출처 | 이유 |
| --- | --- |
| 빅카인즈 | 기사 본문은 P3 요약 뒤 지운다(대표 결정 11/1). 요약 모델 서버(`P3_LLM_*`)가 연결되기 전에 매일 받으면 지우지 못한 본문이 쌓인다 |
| 광주 보도자료 | 2026-11-02 부터 누리집이 자동 요청을 400 으로 막는다. 브라우저 흉내는 하지 않는다 |
| KOSIS | 수집 명세의 기간(2023–2025)이 고정이고 범위가 다르면 거절된다. 새 달 반영은 분석 기간을 늘릴 때 따로 |
| 에어코리아 확정 · 세출 | 사람이 받은 XLSX 를 input 에 넣어야 하는 파일 수집 |
| 에어코리아 측정소 | 측정소 목록은 거의 바뀌지 않는다 |

설치(서버 관리자, root):

```bash
sudo install -o root -g root -m 755 deploy/collector/schedule/daily_collect.py /usr/local/sbin/issueatlas-collect-daily.py
sudo install -o root -g root -m 644 deploy/collector/schedule/issueatlas-collect-daily.service deploy/collector/schedule/issueatlas-collect-daily.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now issueatlas-collect-daily.timer
# 바로 한 번 돌려 확인(끝날 때까지 기다린다)
sudo systemctl start issueatlas-collect-daily.service
```

끄기: `sudo systemctl disable --now issueatlas-collect-daily.timer`. CD 는 이 파일들을 갱신하지 않는다 — 바꾸면 위처럼 다시 설치한다.

## 수동 실행

첫 collector CD 성공 후 실행한다. CLI 기본 기간을 운영 일정으로 간주하지 말고 담당자와 확인한 범위를 명시한다.

```bash
# KOSIS: 처음에는 작은 범위로 수집. 같은 spec_id의 기존 사양과 범위가 다르면 거절된다.
sudo issueatlas-collect kosis --regions 46130 --start-year 2023 --end-year 2025 --spec-id SP01

# 에어코리아 측정소 API. /etc/issueatlas/collector.env의 AIRKOREA_SERVICE_KEY 필요.
sudo issueatlas-collect airkorea-stations

# 담당자가 확인한 최종확정 XLSX를 input에 넣고 컨테이너 경로로 지정한다.
sudo issueatlas-collect airkorea-final --xlsx /inputs/final.xlsx --start-date 2024-01-01 --end-date 2024-01-02
# 여수시 · 광주광역시 보도자료 목록 → 원본 장부(raw_record). 실행기가 그 출처만 이어 정제한다. 키 없음. robots.txt 간격(여수 30초)을 지켜 여수 약 33분, 광주 약 3분
sudo issueatlas-collect press --site yeosu --db
sudo issueatlas-collect press --site gwangju --db
# 광주 누리집이 2026-11-02 부터 자동 요청을 막는다(400). 옛 press_release 표(10/30 수집)가 남은 DB 에서만 옮긴다(V0044 가 다 옮긴 DB 에서는 지움 → PRESS_OLD_TABLE_GONE). 몇 초
sudo issueatlas-collect press --site gwangju --db --from-table
# 지방재정365 세부사업별 세출현황 XLSX(통합자료실 첨부, 연도마다 한 파일)를 input 에 넣고 한 해씩. 파일 하나 약 30초
sudo issueatlas-collect lofin --xlsx /inputs/2025_세부사업별세출현황.xlsx --db
# 온통청년 청년정책(광주 5구 · 여수시, 새 법정 시군구 코드). collector.env 에 YOUTHCENTER_API_KEY 필요. 약 1~2분
sudo issueatlas-collect youth-policy
# 빅카인즈 뉴스. collector.env 에 BIGKINDS_API_KEY 필요. 하루 약 1,100건 · 본문 수집에 약 12분(2026-10-28 실측)
# 첫 적재는 분석 기간 마지막 달 2025-12 를 한 주씩(한 번에 약 1.5시간, 검색 호출 상한 200회 안). --until 날짜는 넣지 않는다
sudo issueatlas-collect bigkinds --start 2025-12-01 --until 2025-12-08
sudo issueatlas-collect bigkinds --start 2025-12-08 --until 2025-12-15
sudo issueatlas-collect bigkinds --start 2025-12-15 --until 2025-12-22
sudo issueatlas-collect bigkinds --start 2025-12-22 --until 2025-12-29
sudo issueatlas-collect bigkinds --start 2025-12-29 --until 2026-01-01
# P2 정제: 장부 → normalized_record. 키 없음. 수집과 같은 잠금이라 수집 중에는 돌지 않는다. 결과 파일 없음(--output 을 붙이지 않는다)
# 수집 뒤에는 자동으로 돈다. 손으로는 규칙 판(rule_version)을 올린 뒤 전체(약 40분) · 한 출처만(1–2분) 다시 돌릴 때
sudo issueatlas-collect refine
sudo issueatlas-collect refine --source press_gwangju
# 기존 대응 후보(existing_response): 정제된 온통청년 정책 · 세출에서 카드 C1 · A3 후보를 뽑는다. 키 없음 · 결과 파일 없음.
# youth-policy · lofin 적재와 refine 뒤에 돌린다. 같은 판을 다시 돌리면 0건 추가
sudo issueatlas-collect responses
# P3 지역 · 시간 (contracts/p3). 키 없음. ① 아직 P3 를 안 돌린 기사(본문 있음) → output 의 articles.jsonl.
# 본문이 들어 있으니 주피터로 옮긴 뒤 지운다
sudo issueatlas-collect region-export
# ② articles.jsonl 을 input 에 옮기고 지역 · 요약 추출. collector.env 에 모델 서버(P3_LLM_BASE_URL · P3_LLM_MODEL,
#    외부 API 면 P3_LLM_API_KEY)가 있어야 한다 — 아직 모델 서버가 없어 연결만 해 두었다. 중간에 멈추면(종료 코드 2)
#    --done 에 이전 결과를 주고 다시 돌린다. 끝나면 input 의 articles.jsonl 은 지운다
sudo issueatlas-collect region-extract --input /inputs/articles.jsonl
sudo issueatlas-collect region-extract --input /inputs/articles.jsonl --done /inputs/extract_1.jsonl
# ③ 추출 결과를 input 에 넣고 적재. 기본은 시험 실행(건수만, 되돌림) → 확인 뒤 --apply. mentions 는 추출 결과에 들어 있다.
#    collector.env 에 JUSO_SEARCH_KEY 가 있으면 적재 전에 장소 주소로 지역을 바로잡는다(결과의 place_check — 없으면 off)
#    SGIS_KEY · SGIS_SECRET 이 있으면 기사 위치(건물 좌표 · 행정동)도 정한다(결과의 locate — 없으면 off, 이미 있는 위치는 그대로)
sudo issueatlas-collect region-load --extract /inputs/extract.jsonl
sudo issueatlas-collect region-load --extract /inputs/extract.jsonl --apply
# ④ 요약이 제대로 생긴 기사의 본문 지우기(기사 계약 v0.3). 시험 실행으로 건수를 본 뒤 --apply, 이어서 refine(전체)
sudo issueatlas-collect region-load --delete-bodies
sudo issueatlas-collect region-load --delete-bodies --apply
# 이미 넣은 기사 위치의 법정동 place_id(kr-<10자리>)를 행정동으로(SGIS 키 필요, 좌표 · 주소는 그대로). 시험 실행 → --apply
sudo issueatlas-collect region-load --relocate
sudo issueatlas-collect region-load --relocate --apply
sudo issueatlas-collect refine

# P4 기사 임베딩·카드 1차 분류(개발 DB에 새 표 배포 후, 순서대로)
# /etc/issueatlas/collector.env 에 GMS_API_KEY 가 있어야 한다.
sudo issueatlas-collect embed-docs --apply
sudo issueatlas-collect embed-cards --apply
sudo issueatlas-collect score --apply

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
