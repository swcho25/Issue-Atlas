# fix/observation-test-isolation — 지도 점 테스트가 남긴 가상 지역 때문에 지역 목록 테스트 실패

- Jira: S15P31C108-135 (후속 수정) · 묶음/단위: P7

## 완료 조건
- [x] develop 의 PlaceApiTest 실패 원인을 찾는다
- [x] ObservationApiTest 가 테스트 데이터를 남기지 않게 한다
- [x] 같은 순서(지도 점 → 지역 목록)로 전체 backend 테스트가 통과한다

## 진행
- 2026-10-29: !50 머지 뒤 develop 파이프라인 250630 backend 실패. PlaceApiTest 가 지역 목록을 C2 예시(6곳)와 STRICT 비교하는데, 같은 스프링 컨텍스트(같은 DB)의 ObservationApiTest 가 넣은 가상 지역 obs_city · obs_other 가 남아 8곳이 됐다. 각 MR 에서는 두 테스트가 같이 없어서 드러나지 않았다
- 2026-10-29: ObservationApiTest 에 @Transactional(테스트마다 되돌림). !51 카드 목록 테스트와 같은 방식. 앞의 DELETE 정리는 필요 없어 뺐다. 전체 backend 47건 PASS, 실행 순서 ObservationApiTest → PlaceApiTest 확인
- 같은 시기 develop 실패 250224 · 250265 는 GitLab 500/502(git fetch) 일시 오류였다

## 다음 할 일 / 범위 밖
- !52 근거 상세 · !53 수집 이력 테스트도 데이터를 남긴다(지역은 아님). 다른 테스트와 겹치지 않지만 같은 방식으로 되돌리게 바꾸면 좋다
