# feat/youth-policy-collector — 온통청년 청년정책 수집 (근거 ③ 기존 대응)

- Jira: (생성 대기 — [P8] 온통청년 청년정책 수집기 추가) · PRD: FR-H1 · FR-C7 · 카드 C1 C3 · 묶음/단위: P8

## 완료 조건
- [x] 온통청년 청년정책 API에서 광주 5구·여수시 정책 목록을 받아 raw_record와 장부에 저장한다 (가상 응답으로 확인)
- [x] 정책마다 정책명·주관기관·분류·사업기간·지역을 남기고, 같은 정책을 다시 받으면 중복 저장하지 않는다
- [x] C1 문서 종류에 policy(정책)를 더하고 P2 입구 검사를 통과한다
- [ ] 실제 키로 한 번 받아 응답 규격을 확인한다 — YOUTHCENTER_API_KEY 발급 대기

## 진행
- 2026-10-29: 시작. 공식 문서가 공개돼 있지 않아 여러 공개 구현에서 겹치는 규격(/go/ythip/getPlcy, apiKeyNm · pageNum · pageSize · rtnType · zipCd, result.youthPolicyList · pagging.totCount)으로 만들었다
- 2026-10-29: 정책 한 건 × 지역 한 곳 = 레코드 하나(place_code_raw = 법정 시군구 코드, bjd). 원천 행 전체는 payload, 장부에는 정책명 · 주관기관 · 분류 · 키워드 · 설명만. storage_scope metadata, 링크 null(원천이 상세 주소를 주지 않음)
- 2026-10-29: 조회수(inqCnt)는 지문에서 뺀다. 내용이 바뀌면 새 원본 · 같은 dedup_key. C1 문서는 발행 시각 필수라 최초 등록 → 최종 수정 순으로 쓰고, 둘 다 없으면 no_published_at 으로 센다
- 2026-10-29: 단위 테스트 10건 · Postgres 통합 테스트 1건 PASS. P2 정제는 LICENSE_UNKNOWN 으로 보류(이용허락 표에 없음)
- 2026-10-30: 박준우 요청으로 P2 이용허락 표에 `공공데이터-이용허락범위제한없음` → full 추가, rule_version p2-0.4.0. 수집기는 metadata 로 보내 min 규칙으로 metadata. 통합 테스트 정제 결과 pass 3

## 다음 할 일 / 범위 밖
- 키 발급 뒤 실호출로 규격 확인(필드명 · resultCode · 오류 응답)
- (해결) P2 이용허락 표 — 2026-10-30 full 로 추가
- 중앙부처 정책도 지역 조회에 함께 나온다. 지자체 정책만 쓸지는 P4 · 카드에서 정한다
- 서버 실행(issueatlas-collect)에 넣는 일
