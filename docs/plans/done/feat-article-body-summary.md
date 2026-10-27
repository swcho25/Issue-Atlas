# feat/article-body-summary — 빅카인즈 원문 링크로 기사 본문을 받는다 (요약은 P3)

- Jira: S15P31C108-107 · PRD: — · 묶음/단위: P2

## 완료 조건
<!-- 검증 가능한 문장으로. 이 목록이 끝나면 작업이 끝난다. -->
- [x] 빅카인즈 응답 JSON 을 주면 기사마다 본문 수집 결과를 낸다 (성공 / 링크 없음 / robots 금지 / 열리지 않음 / 본문 못 뽑음 / 다른 기사). `http://` 없는 링크는 붙여서 시도한다. 테스트는 직접 만든 HTML 로, 네트워크 없이 돈다
- [x] robots.txt 가 막은 주소는 요청하지 않고, 같은 사이트 요청 사이에 간격을 둔다. 인증서는 OS 저장소로 확인하고 검증을 끄지 않는다
- [x] 뽑은 본문이 빅카인즈 `content` 와 같은 기사인지 맞춰 보고, 다르면 본문을 버린다
- [x] ~~성공한 본문에 `summary` 와 요약 방식 버전을 붙인다 (첫 버전: 앞 3문장)~~ → 요약은 P3(정우현)가 맡기로 해 뺐다 (2026-10-27)
- [x] `python -m pipeline.article <응답.json>` 이 결과를 JSON Lines 로 내고, `pnpm check` 를 통과한다

## 진행
<!-- 날짜: 한 일 · 결정 · 막혔던 것 -->
- 2026-10-27: 시작
  - 사전 확인: 빅카인즈 원문 링크 20건(언론사 10곳) 중 16건을 trafilatura 로 본문 추출, 빅카인즈 `content` 와 일치. 실패 4건은 링크 없음 · `http://` 없는 링크(404) · 인증서 체인 오류(부산일보) · 짧은 다른 글(KBS 영상 기사 추정)
  - 결정: 회사 데모용 파이프라인으로 본문 수집 · 요약을 한다 (회사 확인은 박준우가 따로). 이번 MR 은 파일 입력 → JSON Lines 출력까지, DB 저장은 하지 않는다
  - 결정: 테스트에 실제 기사 HTML 을 넣지 않는다 (기사 원문 커밋 금지). 직접 만든 HTML 을 쓴다
  - 구현: `pipeline/article/` (fetch · body · summarize · run · `__main__`). 의존성 trafilatura 2.3.1(Apache-2.0) · truststore 0.10.5(MIT)
  - 상태 코드: `ok` · `NO_LINK` · `NO_REFERENCE`(빅카인즈 content 없음 → 요청 안 함) · `ROBOTS_DISALLOWED` · `NETWORK_ERROR` · `HTTP_ERROR` · `NO_BODY`(100자 미만) · `CONTENT_MISMATCH`
  - robots.txt: RFC 9309 대로 401·403·5xx 는 전부 막힘, 404 등은 허용. User-Agent `IssueAtlasBot/0.1` 로 이름을 밝힌다
  - 같은 기사 판정: 빅카인즈 content 의 30자 조각(공백 제거, 0 · 60 · 120번째 글자부터) 중 하나가 본문에 있으면 같은 기사
  - 실데이터(여수 2024-01, 20건): ok 17 · HTTP_ERROR 1(남도일보 404) · ROBOTS_DISALLOWED 1 · NO_LINK 1(경남일보). 사전 확인 때 인증서 오류였던 부산일보는 OS 인증서 저장소로 통과
  - 광주일보는 `IssueAtlasBot` 이름으로 요청하면 robots.txt 가 403 → 전부 막힘으로 처리. 이름을 바꿔 피하지 않는다
  - 요약: 헤럴드경제 6건이 첫 문장 앞에 `[언론사(지역)=기자명 기자]` 를 붙여 줄 첫머리 기자 머리말을 떼게 했다 (부제목 다음 줄에 오는 경우 포함). 17건 모두 3문장 요약, 머리말 0건
  - 마무리: `pnpm check:all` 통과 (harness · backend format/build · frontend lint/typecheck/test/e2e · engine lint/test 269건)
  - 범위 변경(MR !32 리뷰 전): 요약은 P3 정우현 님이 본문을 받아 하기로 해 `summarize.py` 와 결과의 `summary` · `summarizer` 칸을 뺐다. 결과 칸은 news_id · provider · url · fetcher · status · http_status · fetched_at · body. 기자 머리말 `[언론사(지역)=기자명 기자]` 는 본문에 그대로 남는다 (지역 단서)

## 다음 할 일 / 범위 밖
- DB 저장: S15P31C108-101(빅카인즈 수집기) · S15P31C108-100(C1 v0.2 문서 칸) 뒤에 붙인다
- 이용허락 표 `BIGKINDS-이용약관` 은 지금 metadata. 본문을 저장하려면 회사 확인 결과와 함께 바꾼다 (노션 결정 먼저)
- 정우현 님(P3 요약)과 맞출 것: 본문을 어디서 읽을지(DB 위치), 결과 칸. 참고로 KPF-BERTSum 은 학습된 모델 파일이 없어 직접 학습해야 한다(GPU · AI Hub 문서요약 데이터)
- 장성우 님께 공유: -101 의 「범위 밖: 본문 수집」을 -107 이 맡는다
- 수집기 이미지(engine/Dockerfile, `uv sync --locked --no-dev`)에 trafilatura · truststore 가 함께 들어간다. 머지 뒤 배포 이미지 크기 확인
- 표본은 지역 언론 · 경제지 위주(여수 1월 20건). 대형 언론사 · 유료 기사 · 자바스크립트로 본문을 그리는 사이트는 아직 확인하지 않았다
