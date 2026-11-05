# fix/question-phrasing-transaction — 질문 실행의 문장화 호출을 DB 트랜잭션 밖으로 분리

- Jira: S15P31C108-254 (상위 S15P31C108-162) · PRD: — · 묶음/단위: P4 · P5

## 완료 조건
- [x] engine 문장화 호출 중에는 DB 트랜잭션이 없고 잡힌 DB 연결이 0 이다(새 테스트로 확인)
- [x] 판정 · 결과 조립은 첫 짧은 트랜잭션, 질문 · 실행 · 문장화 · 근거 행 저장은 두 번째 짧은 트랜잭션. 실행 결과는 지금처럼 한 번만 쓴다(UPDATE 없음)
- [x] QuestionApiTest 문장화 시나리오(done · 오류 · 시간 초과 · 검사 탈락 · engine 안 부름)가 그대로 통과하고 C2 응답 · argument_phrasing 사유 코드는 그대로다
- [x] `corepack pnpm check` 통과

## 진행
- 2026-11-05: 시작. 문제: `QuestionService.create()` 가 `@Transactional` 안에서 engine 문장화(실측 13초 · 최대 `ENGINE_TIMEOUT` 40초)를 불러 질문 1건이 그동안 DB 연결 하나를 잡는다(Hikari 기본 풀 10 → 동시 질문 10건이면 API 전체가 멈춤). `open-in-view: false`, 저장소는 JdbcClient 라 트랜잭션만 끊으면 연결도 돌려준다.
  결정(사용자 확인): 실행 행을 카드 문구로 먼저 커밋하고 나중에 ③ · ⑤ 를 UPDATE 하는 안 대신, 판정 · 결과 조립(①) → engine 호출(트랜잭션 밖) → 질문 · 실행 · 문장화 · 근거 행을 한 번에 저장(②). 실행 결과는 한 번만 쓴다(V0023 「고치지 않는다」), 채운 칸 수 · 응답 시간도 한 번에 계산, 문장화 중 서버가 죽어도 짝 잃은 질문 · 실행 행이 남지 않는다.
- 2026-11-05: `QuestionService.create()` 의 `@Transactional` 을 떼고 `TransactionTemplate` 두 번(`draft` · `save`)으로 나눔. ①에서 쓰는 것은 기존 대응 후보 → 근거(`createResponseEvidence`, 같은 판은 같은 ID)뿐, 질문 행은 ③으로 옮김. 응답 · 사유 코드 · 로그는 그대로.
  새 `QuestionTransactionTest`(실제 커밋을 봐야 해 테스트 트랜잭션 없이, `CardApprovalConcurrencyTest` 처럼 이 클래스만 쓰는 DB): 가짜 engine(`@MockitoBean ArgumentEngineClient`)이 불린 순간 트랜잭션 · 빌려 간 Hikari 연결 · 질문 행 수를 잰다. 옛 코드에서는 `true · 1 · 1` 로 실패, 새 코드에서 `false · 0 · 0` 으로 통과. `QuestionApiTest` 28 · `ArchitectureTest` 6 통과.
- 2026-11-05: `corepack pnpm check` 통과(backend format · backend test 227개).

## 다음 할 일 / 범위 밖
- push · MR(리뷰어 장성우)은 사용자 확인 뒤
