# feat/ai-input-contract — AI 모듈이 받는 입력(문서 · 판정 결과)과 처리 상태를 계약으로 고정한다

- Jira: [S15P31C108-153](https://ssafy.atlassian.net/browse/S15P31C108-153) (에픽 S15P31C108-52 분류) · PRD: FR-C (논증 카드) · 묶음/단위: P4 · P5 Day 1

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] `contracts/ai/` 에 문서 입력(카드 입력)·판정 입력(통계·판정 결과) 스키마 v0.1 초안과 빈 칸의 뜻 표가 있다
- [x] 실제 기사 10건 · metadata 문서 5건 샘플 요청 목록이 있고, 기사 본문은 들어 있지 않다
- [x] 가상 fixture(문서 4건 · 판정 3건: 성공 / 자료 부족 / 비교 불가)가 fixture 표시를 달고 스키마를 통과한다 (`pnpm engine:test`)
- [x] backend 공유용 AI 모듈 결과 상태(완료 · 입력 대기 · 오류) 표와 예시가 있다
- [x] 실행 계획에 기존 코드 재사용 표가 있다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-30: 시작. 기존 브랜치 통합 여부 확인 — `test/embedding-model-evaluation`(임베딩 평가 2커밋) · `feat/argument-judgment-rules`(판정 규칙 4커밋, Jira S15P31C108-84 는 「완료」) 둘 다 develop 에 없고 push 도 안 됨. `feat/embedding-evaluation` 은 자기 커밋 없음. 이 브랜치는 `origin/develop`(068cc27)에서 새로 땄다
- 2026-10-30: 결정 — 문서 입력 칸은 C1 v0.2 `document` · P2 v0.5 · P3 v0.1 `news_event`(`feat/news-event-station-places`, 병합 전) 이름을 따른다. P3 는 기사 하나에 지역 하나라 `regions[]` 첫 항목으로 옮기고, `time_precision = published` 는 `event_period = null` 로 둔다(게시일을 사건 기간으로 쓰지 않음)
- 2026-10-30: 결정 — 빈 칸의 뜻은 `extraction_status`(done / pending)로 갈라 적는다. 같은 null 이라도 「추출 전」과 「글에 없음」이 다르다. 지역 `confirmed` 는 P3 지역만, 발행 기관 · 원천 개체명은 `candidate` + 원천 값(`raw`)
- 2026-10-30: 결정 — 판정 입력은 C2 argument 칸을 `$ref` 로 그대로 쓰고(C2 의 blocked → insufficient · 비교 조건 · 한정어 규칙표 검사가 따라옴), AI 용 칸 3개(`statistics_points` · `excluded_provisional` · `rebuttal_candidates`)만 더했다. 판정 예시 3개는 C2 예시 3개에서 만들었고, 같은 값인지 테스트가 본다
- 2026-10-30: 결정 — 가상 자료는 `fixture: true` + 제목 `[fixture]` 시작(스키마 검사) + 링크 `example.com`. 실제 샘플은 `fixture: false`, 본문 없음
- 2026-10-30: 샘플 — 실제 기사 10건은 로컬 평가 덤프(`outputs/embedding-eval/real-labeled`, 저장소 밖)에서 제목 · 링크 · 발행일만 옮겼다. 보도자료 5건은 여수시 · 광주광역시 게시판 목록 첫 쪽을 브라우저로 한 번씩 읽었다(글 보기 페이지는 열지 않음). 로컬 평가 DB 에는 `press_release` 가 없다
- 2026-10-30: 검증 — `pnpm engine:lint` 통과, `pnpm engine:test` 407건 통과(새 53건). 틀린 입력 31가지가 의도한 칸에서 실패하는지 오류 위치를 하나씩 확인. ajv(draft2020, C2 스키마 `-r`)로 예시 10개 valid. ajv strictTypes 경고는 C2 argument 스키마와 같은 종류(조건문에 type 생략)라 그대로 둠
- 2026-10-30: 결정(사람) — `feat/argument-judgment-rules` · `test/embedding-model-evaluation` 은 테스트용이라 로컬에만 둔다(push · MR 안 함). 보도자료 수집기의 당일 글 문제는 P1 담당이라 이 작업에서 다루지 않는다
- 2026-10-30: 로컬 DB 확인 — 컨테이너 `issueatlas-embedding-eval` 의 `c108`(Flyway V0014, KOSIS SP01 · SP02 · SP10 · 측정소 원본 4,954행, 광주광역시 보도자료 2,600행 2024-10-25~2025-12-31, `card` 2행, 정제 · 근거 · `air_monthly` 0행)과 `p4_eval`(평가용 옛 덤프: 기사 30건 `news_article` · `normalized_document`, 에어코리아 2024-01 한 달)
  - 실제 행으로 문서 입력을 만들어 스키마 검사(본문은 메모리에서만, 저장 안 함): 기사 30건 · 보도자료 2,600건 모두 통과(`extraction_status = pending`). 기사 30건 중 본문 있음 20 · 없음 10(NO_LINK 6 · ROBOTS_DISALLOWED 3 · CONTENT_MISMATCH 1) — P2 v0.5 에서는 본문 없는 10건이 `BODY_MISSING` 으로 보류된다
  - 해결된 것: 기사 발행 시각은 30건 모두 한국 시각 0시 — 날짜만 오는 것으로 본 `published_precision = day` 가 맞다(빅카인즈 응답 원문은 DB 에 없어 원천 형식까지는 못 봄). 카드 판 · 분류 판(`C1` · `A3` 판 1 · `tax-2026.10`)이 판정 예시와 같다. 빅카인즈 분류(`지역>…`)는 기사 지역과 자주 다르다(D15 광주 기사가 `지역>충남 · 지역>경기`) — 원천 메타를 `candidate` 로만 두는 규칙의 근거
  - 실제 값으로 바꿀 수 있는 것: 여수 19–39세 순이동 합계 2023 −1,537 · 2024 −1,935 · 2025 −2,262(KOSIS SP01, C3=905)는 판정 예시와 같은 `increasing`. 다만 C2 예시는 15–39세라 SP01 에 없는 연령대다 — 바꾸려면 C2 예시를 먼저 고쳐야 한다(P7 리뷰)
  - 로컬 DB 로 안 되는 것: 카드 정의(경쟁 설명 · 상한선 · 적용 조건 — `card` 는 목록 칸뿐), P3 `news_event`(V0016 미적용), 출처 등급(`source.reliability_grade` 비어 있음), A3 연평균(정제 · 월별 집계 없음, 시간값은 2024-01 한 달), 기사 `content_hash` · 현재 P2 판(평가 덤프는 `p2-doc-draft-0.1`), 여수시 보도자료(없음)
- 2026-10-30: 결정(사람) — 보도자료 샘플 중 광주광역시 2건(2026-06, 분석 기간 밖 · 로컬 DB 에 없음)을 로컬 DB 의 기간 안 행 `gwangju:18923`(미세먼지 계절관리제 시행, A3 후보) · `gwangju:19039`(청년 일경험, C1 후보 · 원천 분류 「소통」)로 바꿨다. 행정통합 전 코드(29) 확인 항목은 19039 로 옮겼다
- 2026-10-30: 확인(사람) — 여러 지역에 걸친 기사를 넓은 단위 하나로 내는 것(광주 · 여수 → `전남광주통합특별시`, `sigun` null)이 P3 의 최종 설계다. P3 에 따로 요청하지 않는다. 문서 입력의 `extraction` 지역은 하나로 고정(`maxContains: 1`, 테스트 추가). 시도 전체 기사는 P3 지역 맞추기에서 모든 시군구에 나오므로 근거에서 빠지지 않는다. `regions[]` 배열은 `candidate` 힌트를 같이 담으려고 둔다
- 2026-10-30: 확인(사람) — `news_event` 규칙 판 칸(V0016 에 없음)은 P3 담당이 따로 넣는다. 요청하지 않고 README 「열린 문제」에 필요하다고만 적었다
- 2026-10-30: 확인(사람) — 청년 연령대 같은 개념은 지표 사전에 있다. 이슈 카드가 지표 사전에서 꺼내 쓰거나 새 지표를 등록해 그 개념을 정한다. 위 「로컬 DB 확인」의 「C2 예시를 먼저 고쳐야 한다」는 틀린 방향이라 C2 수정 요청은 하지 않는다
- 2026-10-30: 마무리 — develop(722c164) 위로 옮기고 낡은 곳을 고쳤다(P3 병합 반영 · 예시 정제 판 `p2-0.5.0` · 여수 당일 글 S15P31C108-121). `pnpm check:all` 통과(harness · backend format · frontend lint · typecheck · test · e2e · backend build · engine lint · engine test 431건)

## 기존 코드 재사용 표

| 기존 | 있는 곳 | 이번에 쓴 것 | 고칠 것 (이번 범위 밖) |
| --- | --- | --- | --- |
| `engine/argument/` 판정 규칙 (judge · comparability · evidence · direction · vocab) | `feat/argument-judgment-rules` (테스트용, 로컬에만 둠) | 판정 입력의 값 모양 — `claim` · `comparability` · `excluded_provisional` 은 `judge()` 출력과 같은 뜻 | 운영 코드로 옮길 때: `vocab.py` 대신 C2 `common.schema.json` 직접 읽기, 근거 충실도 `qualifier-0.1` 계산 추가, 출력을 이 판정 입력 모양으로 조립 |
| `engine/tests/argument_samples.py` (C1 카드 판정 칸) | 같은 브랜치 | — | 카드 정의 명세(card-0.1)가 저장소에 들어오면 판정 입력의 `rebuttal_candidates` 출처로 잇기 |
| `engine/embedding_eval/manual-chunk-labels.md` (실제 기사 20건 · 지역 범위 판정) | `test/embedding-model-evaluation` (테스트용, 로컬에만 둠) | 실제 기사 10건 선정 · `label_region` · `label_id` | 없음 |
| `engine/embedding_eval/` 청크 · 검색 · 순위 | 같은 브랜치 | 쓰지 않음 | 문서 검색 단계에서 `document-input` 을 입력으로 받게 |
| C1 v0.2 `document` · `storage_scope` 규칙 | develop | 칸 이름 · 본문 규칙(full ⇔ body) · excerpt 규칙 | 없음 |
| P2 v0.7 `obs_key` · `content_hash` · `rule_version` · `normalized_ready` | develop | `version` 칸 | 없음 |
| P3 v0.1 `news_event` · `place.attrs` | develop (V0016 · V0017, S15P31C108-148) | `regions` · `event_period` · `summary` 옮기는 규칙 | P3 칸 이름이 바뀌면 README 표를 고친다 |
| C2 v0.1 argument · common | develop | 판정 입력 `$ref`, 판정 예시 값 | 없음 |
| `pipeline.refine.schema` 의 스키마 검사 방식 | develop | 테스트의 Draft 2020-12 + format 검사 | 없음 |

## 다음 할 일 / 범위 밖
- MR 리뷰: 박준우(P2) · 정우현(P3) · 장성우(P7). 요청은 두 가지 — P3 샘플 기사 10건(`samples/real-article-requests.json`) 돌려 주기, P7 처리 상태(`status.schema.json`) 받기
- 보도자료의 C1 연동 · 지역 · 시간 추출이 없다 — 그 전까지 보도자료는 늘 `pending`
- 판정 예시의 가상 통계를 KOSIS 실제 값으로 바꾸기 — 청년 연령대는 이슈 카드가 지표 사전에서 정한 값을 따른다(지금 수집 범위: 연령 계 · 19–34 · 19–39)
- 출력(`output`) 모양 · 출력 검사기(숫자 · 금지어 · 근거 구절) — v0.2
- 외부 LLM 에 실제 본문을 보내도 되는지 기업 계약 확인
- 카드 정의 명세(card-0.1)를 `contracts/` 에 넣기 — 받는 쪽 리뷰 필요
- contracts 검사를 `scripts/check.mjs` 에 잇기 (지금은 engine 테스트가 대신 봄)
