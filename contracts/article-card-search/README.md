# 기사→카드 1차 분류 저장 계약 v0.2

Jira S15P31C108-204 · S15P31C108-316. Flyway V0035 · V0052. 이 판은 C1·A3 기사 실험에 한정한다.

v0.2(2026-11-09): `document_card_score` 에 선택 방식 `method` 와 학습 분류기 확률 `probability` 를 더했다. 기존 행과 지금 설정은 모두 `cosine` 이라 `selected` 는 v0.1 과 같다. 받는 쪽(V0036 `observation`)은 계속 `selected` 만 읽는다.

- `document_search_input`: `news_event.summary`가 있고 `normalized_ready`의 최신 뉴스 행에서 제목과 `raw_record.content_hash`를 찾은 기사. `input_text`는 `제목: …\n요약: …`이며 `input_version=news-title-summary-v1`이다. 내용의 SHA-256은 `input_hash`, 뉴스 ID·원본 해시·입력 판·입력 해시의 SHA-256은 `input_id=dsi:…`이다. `doc_id=news:{news_id}`.
- `document_embedding_v1`: 입력 판의 `gemini-embedding-2` 벡터 `vector(1536)`. 문서당 활성 입력은 고유 부분 인덱스로 하나만 허용한다. 활성 전환은 문서 잠금과 한 트랜잭션에서 한다.
- `card_search_profile`: `card.status=card`와 `card.current_version`에 대응하는 `card_version.spec`만 사용한다. `card-profile-v1`은 이름·질문·포함·키워드를 순서대로 잇고 `exclusion`을 넣지 않는다. 카드당 활성 프로필 하나.
- `document_card_score`: 활성 기사×카드 벡터의 `1 - cosine_distance`(`cosine_similarity`), 기준값 판, 기준값, 선택 방식(`method`), 확률(`probability`), `selected`. 이 표는 모델 제안 결과이며 사람 확정 연결과 구분한다.
  - `method=cosine`: `selected = cosine_similarity >= threshold`. `probability` 는 비워 둘 수 있다(지금 engine 은 비운다).
  - `method=f4`: 학습 분류기 확률(0~1). `selected = probability >= threshold`이고 `probability` 가 꼭 있어야 한다. 분류기는 S15P31C108-316 의 다음 MR 에서 들어온다.
  - 방식과 상관없이 `cosine_similarity` 는 계속 저장한다. DB 검사(`ck_document_card_score_selection`)가 방식 · 확률 · `selected` 가 서로 맞는지 막는다.
- 화면 응답(V0036): `observation` view 의 기사 `tags` 가 활성 입력 · 활성 카드 프로필로 계산된 `selected` 카드를 읽는다 → 질문 응답 `articles[]`(지도 기사 점). 근거 문서(`data.documents`)로는 쓰지 않는다. 입력 · 카드 프로필이 바뀌면 `score` 를 다시 돌려야 태그가 다시 찬다.

GMS `gemini-embedding-2:embedContent`의 `embedContentConfig.outputDimensionality=1536`을 지정한다. 카드와 기사는 같은 모델·차원으로만 비교한다. `thresholds.json`의 임시 기준은 AI 라벨로 만든 것이며 사람 검토 전 확정 연결로 취급하지 않는다. `ai-label500-v2`(2026-11-09, S15P31C108-312)는 A3 만 독립 평가 기사 500건의 AI 1차 · 눈가림 2차 라벨이 같은 489건으로 다시 정했다(0.6791 → 0.667, 5겹 교차검증 정밀도 · 재현율 0.84). C1 은 기준값 하나로 둘 다 0.8 을 넘지 못해(교차검증 0.68) `ai-draft-v1` 값을 그대로 둔다. 기준값을 바꾸면 `score --apply` 를 다시 돌려야 `selected` 가 바뀐다. 최신 정제 행이 없는 기사는 입력을 만들지 않고, 정제된 뒤 다시 실행하면 추가된다.

`thresholds.json` 은 판(`version`) · 라벨 상태(`label_status`) · 카드별 `{"method", "threshold"}` 다. C1 · A3 가 모두 있어야 하고, 모르는 방식이나 -1~1 밖 기준값은 `score` 가 거부한다. **되돌리기**: 카드의 `method` 를 `cosine` 으로, `threshold` 를 코사인 기준값으로 바꾸고 `score --apply` 를 다시 돌린다. 코사인이 이미 저장돼 있어 임베딩을 다시 만들 필요가 없다.

**배포 순서**: V0052 가 적용되지 않은 DB 에서 새 `score --apply` 를 돌리면 `method` 칸이 없어 실패한다. backend(Flyway) 가 먼저 배포된 뒤 수집기 `score` 를 돌린다.
