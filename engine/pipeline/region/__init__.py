"""P3 지역 · 시간: 정제된 기사 → 요약 · 사건 시간대 · 위치 · 기사 지역(news_event).

계약: contracts/p3. LLM(지역 · 장소 · 요약 · 시간 추출)은 OpenAI 호환 모델 서버에 묻고,
나머지(지오코딩 ·
위치 · 규칙 검사 · 여러 지역 · 적재 · 본문 지우기)는 수집기에서 돈다. 규칙은 p3-region-lab
실험(시험 세트 시군구 95~100%, 프롬프트 p9.1)에서 옮겼다 (S15P31C108-190).

- labels: 지역 이름 체계(여수시 · 광주 북구 · 광주권 · SIDO · OUT:충남 · NAT) ↔ 시도 · 시군 · 구
- places: 법정동 코드에서 만든 지명 사전
- text: 기사 본문 앞부분 정리(제목 · 사진 설명 · 출처 표시)
- regions: 기사 지역 여러 개(news_event.regions)
- checks: 적재 전 고치기 · 검사, 본문을 지워도 되는 요약인지
- export: 아직 P3 를 안 돌린 기사 → 추출기 입력 JSONL (수집기 region-export)
- llm · answer_region · answer_summary · extract: 모델 서버에 지역 · 요약 질문
  (수집기 region-extract, S15P31C108-197)
- load: 추출 결과 → news_event, 본문 지우기 (수집기 region-load, S15P31C108-195)
"""
