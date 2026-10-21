---
name: check
description: 바뀐 영역만 lint · typecheck · test 를 돌리고, 실패하면 원인을 고친다. 구현 중간이나 커밋 전에 쓴다.
---

# check

1. 루트에서 `pnpm check` 를 실행한다.
   - pnpm 이 PATH 에 없으면 `corepack pnpm check`.
   - MR 직전이면 `pnpm check:all`.
2. 통과하면 영역과 걸린 시간을 한 줄로 알리고 끝낸다.
3. 실패하면 출력 끝의 `[FAIL]` 안내를 먼저 읽는다.
   - 코드 문제: 원인을 고치고 1번부터 다시. **같은 실패를 세 번 고치지 못하면 멈추고 사람에게 보고한다.**
   - 환경 문제(Docker 꺼짐, 의존성 없음): 고치지 말고 안내 문구 그대로 사람에게 알린다.
4. 테스트를 지우거나 `skip`·`@Disabled`·`eslint-disable` 로 통과시키지 않는다. 꼭 필요하면 이유를 적어 사람에게 묻는다.
5. 실행 계획 파일(`docs/plans/active/<branch>.md`)이 있으면 「진행」에 결과 한 줄을 남긴다.
