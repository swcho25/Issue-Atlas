-- S15P31C108-283 C2 v1: argument 에 claim.label · applicability 가 필수 칸으로 생겼다. GET /v1/arguments/{run_id} 는
-- 저장된 실행 결과(argument_run.result)를 그대로 내보내므로, 이 칸 전에 저장된 실행에 두 칸을 채운다.
-- 판정 배지는 null(화면은 run_status 문구), 적용 조건은 빈 배열. 지난 실행은 다시 계산하지 않고 다른 칸 · 값도 그대로다.
UPDATE argument_run
SET result = jsonb_set(result, '{claim,label}', 'null'::jsonb)
             || jsonb_build_object('applicability', '[]'::jsonb)
WHERE NOT result ? 'applicability';
