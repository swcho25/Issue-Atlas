# feat/article-card-score-method — 기사 분류 점수에 학습 분류기 확률 저장 추가

- Jira: S15P31C108-316 · PRD: — · 묶음/단위: P4 (기사→카드 1차 분류)
- 이 브랜치는 MR 1 이다. 점수 표와 설정이 학습 분류기를 받을 수 있게 하되 **동작은 바꾸지 않는다**(두 카드 모두 cosine 유지). F4 분류기 교체는 MR 2 `feat/article-card-f4-classifier` 에서 한다.

## 완료 조건
- [x] Flyway V0052 적용 뒤 `document_card_score` 에 `method`(기본 `cosine`)·`probability`(0~1, 빈 값 허용) 칸이 있고, 선택 검사가 방식별로 `selected = cosine_similarity ≥ threshold` / `selected = probability ≥ threshold` 를 지킨다 (backend 테스트)
- [x] `engine/ai/classify/thresholds.json` 이 카드별 `method`·`threshold` 를 갖고 `score` 가 그 방식으로 `selected` 를 정한다. 두 카드가 cosine 인 지금 설정에서 결과가 바꾸기 전과 같다 (engine 테스트)
- [x] `contracts/article-card-search/README.md` v0.2 에 새 칸·방식 설정·되돌리는 법이 적혀 있다
- [x] engine lint·test, backend 포맷·test 가 통과한다

## 진행
- 2026-11-09: 시작. 실험 결론(`test/embedding-open-source-eval` 의 small-text·MR213 재평가)을 develop 에 옮기는 첫 단계. 같은 추가 500건(AI 2차 라벨)에서 현재 develop(C1 0.7129 · A3 0.667) 공통 최저 46.0%, F4 AL128 61.4%. AI 1차 라벨에서는 61.1% 대 48.4% 로 C1 에서 뒤집힌다. 두 카드 모두 바꾸기로 정했다(사용자). 코사인은 계속 저장해 설정만으로 되돌린다.
- 2026-11-09: V0052 추가. 기존 행은 기본값 `cosine` 이고, 선택 검사(`ck_document_card_score_selection`)를 방식별 규칙으로 바꿨다. 방식(`ck_…_method`)·확률 범위(`ck_…_probability`) 검사도 더했다. engine 은 `model.card_rules`·`decide` 로 설정을 읽고 고르며, `store.save_scores` 가 `method`·`probability` 를 쓴다. 이 MR 에서 받는 방식은 `cosine` 하나뿐이고 `f4` 설정은 거부한다(MR 2 에서 연다). `thresholds.json` 은 판 `ai-label500-v2`·값 그대로 모양만 바꿨다.
- 2026-11-09: backend `ObservationViewTest`(새 테스트: f4 확률로 고른 카드가 태그가 되는지, 검사 위반 5가지) · `QuestionApiTest` · `FoundationMigrationTest` 통과. engine ruff·pytest 617개 통과. 로컬 `issue_atlas_latest` 읽기 전용 비교: 3,478행에서 예전 숫자 기준값과 새 판정이 0행 다름(A3 선택 434). 로컬 DB 는 C1 프로필이 현재 승인 판과 맞지 않아 C1 점수 행이 없다. 그래서 C1 은 단위 테스트로만 확인했다.
- 2026-11-09: `pnpm check`(node scripts/check.mjs) 통과. backend 포맷, backend 전체 test(104.6초), engine lint, engine test 617개. 이번에는 pnpm store EPERM 이 나지 않았다.
- 2026-11-09: 리뷰 권장 2건 반영. 계약 색인(`contracts/README.md`)을 v0.2 로 올렸다. cosine 행의 확률은 DB 가 막지 않으므로 계약 문구를 「비워 둘 수 있다(지금 engine 은 비운다)」로 맞췄다. MR 2 에서 cosine 을 유지한 채 F4 확률만 나란히 저장할 여지를 남기려는 것이다. `pnpm check:all` 통과(harness · backend format · frontend lint·typecheck·test·e2e · backend build · engine lint · engine test 617개).

## 다음 할 일 / 범위 밖
- MR 2 `feat/article-card-f4-classifier`(이 브랜치 끝에서 분기, 같은 Jira):
  - 순수 Python F4 추론 `ai/classify/f4.py`. 추론에는 scikit-learn 을 쓰지 않는다. engine 이미지는 `--no-dev` 이고, scikit-learn 은 dev 그룹에만 둔다
  - 모델 파일 `ai/classify/f4_model.json`: 카드별 글자 조각 사전·idf·가중치·판
  - `train` 명령: 저장소 밖 학습 ID·라벨 → DB 입력 문장·벡터 → 모델 파일
  - thresholds 판 `f4-al128-v1`(두 카드 f4·0.5), `deploy/tests/test_ci_selection.py` 에 모델 파일 경로 추가
  - 확인: scikit-learn 과 1e-9 이내로 같음 / 추가 500건 실험값 재현(C1 43/27/7/423 · A3 49/8/9/433) / 3,478건 선택 수 변화 / 브라우저에서 지도 기사 점
- 시작 전에 박준우 님과 공유: !213(A3 0.667)을 F4 가 대체한다. C1 LLM 2단계는 F4 후보 위에 얹는 구조로 맞춘다
- 범위 밖: 사람 라벨로 다시 학습(C1 경계 54건 · 판정 갈린 C1 18 · A3 11건), KURE-v3·본문 청크 방식
- 개발 서버 배포 뒤 `score --apply` 다시 실행, 선택 수를 Jira 코멘트로 남김. 이 MR 만으로는 `selected` 가 바뀌지 않는다(method 칸만 `cosine` 으로 찬다). backend(V0052) 배포가 먼저다
- MR 에 화면 응답(P7) 담당 계약 리뷰 요청
- 로컬 `issue_atlas_latest` 는 C1 프로필이 현재 승인 판과 맞지 않아 C1 점수 행이 없다. MR 2 의 재현 검사 전에 로컬에서 `embed-cards --apply` → `score --apply` 가 필요하다
