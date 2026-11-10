# 기사→카드 1차 분류 저장 계약 v0.4

Jira S15P31C108-204 · S15P31C108-316 · S15P31C108-326. Flyway V0035 · V0052 · V0053. 이 판은 C1·A3 기사 실험에 한정한다.

- v0.2(2026-11-09): `document_card_score` 에 선택 방식 `method` 와 학습 분류기 확률 `probability` 를 더했다. 이때는 두 카드 모두 `cosine` 이라 `selected` 가 v0.1 과 같았다.
- v0.3(2026-11-09): 두 카드를 `f4`(학습 분류기 확률 ≥ 0.5)로 바꿨다(`thresholds.json` 판 `f4-al128-v1`). 칸은 그대로이고, 받는 쪽(V0036 `observation`)도 계속 `selected` 만 읽는다. 바뀌는 것은 어떤 기사가 태그를 받는지다.
- v0.4(2026-11-10): ⑤ 반박 검색 질의 표 `card_rebuttal_profile` 을 더했다(아래 「반박 검색 질의」). 기존 표 · 태그는 그대로다. 아직 읽는 쪽이 없고, 질문 실행이 반박별 근거 후보를 고를 때 읽는다(S15P31C108-326 다음 MR).

- `document_search_input`: `news_event.summary`가 있고 `normalized_ready`의 최신 뉴스 행에서 제목과 `raw_record.content_hash`를 찾은 기사. `input_text`는 `제목: …\n요약: …`이며 `input_version=news-title-summary-v1`이다. 내용의 SHA-256은 `input_hash`, 뉴스 ID·원본 해시·입력 판·입력 해시의 SHA-256은 `input_id=dsi:…`이다. `doc_id=news:{news_id}`.
- `document_embedding_v1`: 입력 판의 `gemini-embedding-2` 벡터 `vector(1536)`. 문서당 활성 입력은 고유 부분 인덱스로 하나만 허용한다. 활성 전환은 문서 잠금과 한 트랜잭션에서 한다.
- `card_search_profile`: `card.status=card`와 `card.current_version`에 대응하는 `card_version.spec`만 사용한다. `card-profile-v1`은 이름·질문·포함·키워드를 순서대로 잇고 `exclusion`을 넣지 않는다. 카드당 활성 프로필 하나.
- `card_rebuttal_profile`: 승인 판(`card.current_version`)의 `rebuttals.items` 마다 검색 질의 하나. 아래 「반박 검색 질의」. (카드, 반박)마다 활성 질의 하나.
- `document_card_score`: 활성 기사×카드 벡터의 `1 - cosine_distance`(`cosine_similarity`), 기준값 판, 기준값, 선택 방식(`method`), 확률(`probability`), `selected`. 이 표는 모델 제안 결과이며 사람 확정 연결과 구분한다.
  - `method=cosine`: `selected = cosine_similarity >= threshold`. `probability` 는 비워 둘 수 있다(지금 engine 은 비운다).
  - `method=f4`: 학습 분류기 확률(0~1). `selected = probability >= threshold`이고 `probability` 가 꼭 있어야 한다. 아래 「F4 학습 분류기」.
  - 방식과 상관없이 `cosine_similarity` 는 계속 저장한다. DB 검사(`ck_document_card_score_selection`)가 방식 · 확률 · `selected` 가 서로 맞는지 막는다.
- 화면 응답(V0036): `observation` view 의 기사 `tags` 가 활성 입력 · 활성 카드 프로필로 계산된 `selected` 카드를 읽는다 → 질문 응답 `articles[]`(지도 기사 점). 근거 문서(`data.documents`)로는 쓰지 않는다. 입력 · 카드 프로필이 바뀌면 `score` 를 다시 돌려야 태그가 다시 찬다.

GMS `gemini-embedding-2:embedContent`의 `embedContentConfig.outputDimensionality=1536`을 지정한다. 카드와 기사는 같은 모델·차원으로만 비교한다. `thresholds.json`의 임시 기준은 AI 라벨로 만든 것이며 사람 검토 전 확정 연결로 취급하지 않는다. `ai-label500-v2`(2026-11-09, S15P31C108-312)는 A3 만 독립 평가 기사 500건의 AI 1차 · 눈가림 2차 라벨이 같은 489건으로 다시 정했다(0.6791 → 0.667, 5겹 교차검증 정밀도 · 재현율 0.84). C1 은 기준값 하나로 둘 다 0.8 을 넘지 못해(교차검증 0.68) `ai-draft-v1` 값을 그대로 둔다. 기준값을 바꾸면 `score --apply` 를 다시 돌려야 `selected` 가 바뀐다. 최신 정제 행이 없는 기사는 입력을 만들지 않고, 정제된 뒤 다시 실행하면 추가된다.

`thresholds.json` 은 판(`version`) · 라벨 상태(`label_status`) · 카드별 `{"method", "threshold"}` 다. C1 · A3 가 모두 있어야 하고, 모르는 방식이나 범위 밖 기준값(코사인 -1~1, 확률 0~1)은 `score` 가 거부한다. **되돌리기**: 카드의 `method` 를 `cosine` 으로, `threshold` 를 코사인 기준값(`ai-label500-v2`: C1 0.7129 · A3 0.667)으로, `version` 을 코사인 판으로 바꾸고 `score --apply` 를 다시 돌린다. 코사인이 이미 저장돼 있어 임베딩을 다시 만들 필요가 없다.

## F4 학습 분류기 (`engine/ai/classify/f4.py` · `f4_model.json`)

- 특징: `input_text`(제목+요약)의 글자 2~4조각 TF-IDF(소문자 · 연속 공백 한 칸 · sublinear · L2 정규화, 카드별 사전)에, 기사 벡터를 단위 길이로 맞춘 뒤 4배 해 붙인다. 카드 프로필 벡터는 쓰지 않는다(코사인 칸에만 쓰인다).
- 확률: 로지스틱(C=1, 클래스 균형 가중치)의 시그모이드. 추론은 scikit-learn 없이 모델 파일(카드별 글자 조각 · idf · 가중치 · 절편)로 계산한다. 같은 모델을 scikit-learn 으로 계산한 값과 1e-9 안에서 같다.
- 판: 모델 파일 `version` 은 `thresholds.json` 의 `version` 과 같아야 `score` 가 돈다. 그래서 DB `threshold_version` 이 모델 판도 가리킨다. 모델 파일의 입력 판 · 임베딩 모델 · 차원이 이 계약과 다르면 거부한다.
- 학습: `python -m ai.classify train --input <저장소 밖 JSON>` (scikit-learn 은 engine dev 의존성). 입력은 기사별 `input_text` · 벡터와 카드별 사전 범위(`pool`) · 학습 기사와 라벨(`train`)이다. 라벨 · 기사 문장은 저장소에 넣지 않는다.
- `f4-al128-v1`: 기존 기사 500건 중 학습 333건의 AI 재검토 라벨에서 카드별로 BreakingTies 128건(시드 20261109)을 골라 학습했다. 사전 범위는 C1 331건(검토필요 2건 제외) · A3 333건. **라벨은 AI 라벨이고 사람 검토 전이다.** 추가 기사 500건 AI 2차 라벨 기준 정밀도 · 재현율은 C1 0.61 · 0.86, A3 0.86 · 0.84 다. 같은 기사에서 코사인(`ai-label500-v2`)은 C1 0.72 · 0.46, A3 0.84 · 0.74 였다. 두 방식 모두 목표(둘 다 0.8)에 못 미친다. AI 1차 라벨로 보면 C1 은 코사인 쪽 공통 최저가 더 높아(코사인 0.76 · 0.61 대 F4 0.48 · 0.89) C1 결과는 라벨 기준에 민감하다.
- 카드 승인본의 포함 범위가 바뀌어도 F4 는 다시 학습하기 전까지 그대로다. 그때는 라벨을 새 기준으로 다시 정하고 `train` 을 다시 돌린다.

## 반박 검색 질의 (`card_rebuttal_profile`, V0053)

- 키: (`card_id`, `card_version`, `rebuttal_id`, `query_version`). `card_version` 은 `card_version` 표에 있어야 한다. (`card_id`, `rebuttal_id`)마다 `is_active` 행은 고유 부분 인덱스로 하나뿐이다.
- `rebuttal-query-v1`: `query_text = 「{spec.name}의 다른 설명: {item.text}」`(앞뒤 공백 제거). ID 나 문장이 빈 항목은 만들지 않는다. `query_hash` 는 `query_text` 의 SHA-256(16진 64자). 반박 실험(로컬 전용)에서 반박 문장만 쓴 질의보다 카드 이름을 붙인 질의를 주 설정으로 골랐다.
- 벡터: 기사와 같은 `gemini-embedding-2` · 1536차원. 기사 벡터와의 `1 - cosine_distance` 를 반박별 후보 점수의 한 축으로 쓴다(다른 축인 지역 글자 TF-IDF 는 질문 때 그 지역 · 기간 기사로 만들고 저장하지 않는다).
- 만들기: `embed-cards` 가 카드 프로필에 이어 만든다. 같은 판 · 같은 질의 · 같은 모델이 활성이면 GMS 를 부르지 않고, 꺼져 있으면 다시 켠다. `--apply` 에서는 승인본에서 빠진 반박 · 옛 카드 판 · 옛 질의 판의 활성 질의를 끈다.
- 카드 승인 판이 바뀌면 `embed-cards --apply` 를 다시 돌려야 새 판 질의가 활성이 된다(카드 프로필과 같다). 이어서 `score --apply` 도 돌린다.

**배포 순서**: V0052 가 적용되지 않은 DB 에서 새 `score --apply` 를 돌리면 `method` 칸이 없어 실패한다. backend(Flyway) 가 먼저 배포된 뒤 수집기 `score` 를 돌린다. 마찬가지로 V0053 이 없는 DB 에서 새 `embed-cards` 는 카드 프로필을 만든 뒤 반박 질의 단계에서 실패한다.
