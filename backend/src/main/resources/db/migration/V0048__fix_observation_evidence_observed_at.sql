-- S15P31C108-272: 통계 · 분모 근거의 시점(observed_at)을 마지막 관측 기간의 끝 경계(다음 달 1일 0시, 포함 안 함)에서
-- 그 기간의 마지막 날(한국 0시)로 고친다. 이 두 종류는 질문 실행이 max(관측 when_end)로 채웠고, 관측 기간은 모두
-- 하루보다 길다(월 · 연, 개발 DB 최소 28일). 새 실행은 QuestionRepository 가 처음부터 마지막 날로 넣는다.
-- 저장된 실행 결과(argument_run.result)는 고치지 않는다(실행 결과 불변).
UPDATE evidence
SET observed_at = observed_at - interval '1 day'
WHERE kind IN ('statistics', 'denominators')
  AND observed_at IS NOT NULL;
