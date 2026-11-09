# feat/article-card-f4-classifier — 기사 분류를 F4 학습 분류기로 교체

- Jira: S15P31C108-316 · PRD: — · 묶음/단위: P4 (기사→카드 1차 분류)
- MR 2. `feat/article-card-score-method`(MR 1, !218) 끝에서 땄다. !218 이 먼저 머지돼야 한다.

## 완료 조건
- [x] 순수 Python F4 확률(`ai/classify/f4.py`)이 scikit-learn 과 1e-9 이내로 같다 (engine 테스트)
- [x] 로컬 DB 에서 추가 500건 확률이 실험 저장값(BreakingTies 128 · 시드 20261109)과 1e-9 이내이고, AI 2차 라벨 혼동행렬 C1 43/27/7/423 · A3 49/8/9/433 을 재현한다
- [x] 모델 파일 `ai/classify/f4_model.json` 과 `thresholds.json` 판 `f4-al128-v1`(두 카드 f4 · 0.5)로 바꾸고, `score` 선택 수 변화(3,478건 기준)를 기록한다
- [x] 계약 v0.3 · engine README 에 F4 · `train` 명령 · 라벨 상태(AI 라벨, 사람 검토 전)를 적는다
- [x] engine lint·test 가 통과하고, 브라우저에서 C1 · A3 질문의 지도 기사 점을 확인한다 — 이 브랜치 화면에는 지도 기사 점이 없어(develop 의 -307 이 뒤에 머지됨) 결과 화면 원문 목록 · `articles[]` 로 확인했다

## 진행
- 2026-11-09: 시작. F4 는 제목+요약 글자 2~4조각 TF-IDF(sublinear, min_df 2, 카드별 사전)에 Gemini 벡터×4 를 붙이고, 로지스틱(C=1, balanced)으로 확률 0.5 를 기준으로 고른다. 학습은 카드별 BreakingTies 128건 · 시드 20261109, 사전은 학습 풀(C1 331 · A3 333). 추론은 scikit-learn 없이 계산한다(engine 이미지는 `--no-dev`).
- 2026-11-09: `f4.py`(추론 · `train` · 모델 파일 검사 · `dumps`), `score` 의 f4 경로(`store.score_inputs` 서버 커서로 200건씩), `train` 명령(DB · API 없음), scikit-learn `>=1.9.1,<1.10` dev 의존성(잠금 1.9.1 · numpy 2.5.4 · scipy 1.18.1 = 실험 판). 학습 입력은 실험 기록(`training_audits.json` · 실험 캐시 벡터)에서 저장소 밖 `outputs/f4-al128-v1-20261109/train_input.json` 으로 내보냈다(내보내기 스크립트는 저장소에 넣지 않음). 모델 파일 845KB · 35줄, 카드별 글자 조각 C1 8,732 · A3 8,827.
- 2026-11-09: 처음엔 로컬 DB 벡터로 재현 오차가 9e-7 이었다. 실험은 DB 벡터(pgvector float32, 길이가 1 에서 조금 어긋남)를 단위 길이로 맞춰 썼다. 그래서 추론 · 학습 모두 벡터를 단위 길이로 맞추게 바꿨다. 그 뒤 재현 오차는 스냅샷 · 로컬 DB 모두 C1 7.1e-13 · A3 1.0e-13, 판정 뒤집힘 0, 혼동행렬 C1 43/27/7/423 · A3 49/8/9/433 이다. AI 1차 라벨로는 C1 32/35/4/426(0.48 · 0.89), A3 48/6/2/434(0.89 · 0.96).
- 2026-11-09: 선택 수(로컬 `issue_atlas_latest` 3,478건, 읽기만): F4 C1 459 · A3 534. develop 코사인 기준값(C1 0.7129 · A3 0.667) 대비 C1 232 → 459(둘 다 226 · 코사인만 6 · F4만 233), A3 434 → 534(둘 다 397 · 코사인만 37 · F4만 137). 3,478건 × 2카드 확률 계산 2.5초. 실제 `score`(저장 없음)도 A3 534 로 같았다.
- 2026-11-09: 브라우저 확인. 로컬 DB 복사본 `issue_atlas_f4check` 에서 backend 를 띄워 Flyway V0048 → V0052 가 실데이터 위에 적용되는 것을 확인했다. 이어서 `embed-cards --apply`(C1 v3 프로필 GMS 1건, 시험 실행 1건 포함 2건), `score --apply` 로 C1 459 · A3 534 를 저장했다(전 행 method f4 · 확률 있음, DB 검사 통과). 확인용 조회 계정은 복사본에만 만들었다. 여수시 C1 질문의 `articles[]` 는 155건으로, 원본 DB 의 옛 코사인 태그 88건보다 많다. A3 는 85건(옛 54). F4 만 고른 기사(코사인 0.70~0.71, 확률 0.92~0.93) 3건이 결과 원문 목록에 보인다.
- 2026-11-09: engine ruff · pytest 626개, deploy `test_ci_selection` 13개 통과.
- 2026-11-09: 리뷰에서 모델 파일 카드 항목이 객체가 아니면 AttributeError 가 나는 것을 ValueError 로 바꿨다(테스트 추가). !218 이 develop 에 머지된 것을 확인해 이 MR 은 develop 을 바로 겨눈다. `pnpm check:all` 통과(harness · backend format · frontend lint·typecheck·test·e2e · backend build · engine lint · engine test).

## 다음 할 일 / 범위 밖
- 박준우 님과 공유: !213(A3 0.667)을 F4 가 대체한다. C1 LLM 2단계는 F4 후보 위에 얹는다
- C1 은 라벨 기준에 민감하다(AI 2차 기준 F4 우세, AI 1차 기준 코사인 우세). 사람 라벨로 다시 학습하면 `train` 으로 모델 파일만 바꾼다(C1 경계 54건 · 판정 갈린 C1 18 · A3 11건)
- 범위 밖: KURE-v3 · 본문 청크 방식
- 배포 순서: !218(V0052) → 이 MR. 배포 뒤 개발 서버 `score --apply`, 선택 수 Jira 코멘트
- 로컬 확인용 DB `issue_atlas_f4check` 와 그 안의 확인용 계정은 지워도 된다
