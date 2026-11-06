-- 운영 지표 사전과 C1 · A3 카드 승인(S15P31C108-159 첫 승인 v2 · -282 계약이 바뀌면 다음 판). Flyway 밖 — 개발 · 운영 DB 에 한 번씩 손으로 실행한다.
-- node scripts/card-seed.mjs 가 contracts/cards 로 만든 파일이다. 직접 고치지 않는다. CardSeedIntegrationTest 가 계약과 비교한다.
--   지표 definition · rule = indicators.json 행 · 카드 rule 그대로 · 카드 초안 = 카드 파일 − card_id · card_version · status · taxonomy_version · rule · card_approval · indicator_snapshots
-- 실행: psql "<DB 접속>" -v ON_ERROR_STOP=1 -c "SET issue_atlas.approver = '<관리자 로그인 이메일>'" -f backend/db/seed/cards-c1-a3.sql
-- DO 블록 하나라 실패하면 아무것도 남지 않는다. 다시 실행하면 승인본이 계약과 같은 카드는 건너뛰고,
-- 계약이 바뀐 카드(지표 규칙 · 초안)는 다음 판으로 승인한다(S15P31C108-282: 결과별 판단 문장 → v3).
DO $seed$
DECLARE
    -- 관리자 API 로 승인할 때 남는 값(로그인 이메일)과 같게. 이메일은 저장소에 적지 않는다
    approver text := nullif(btrim(current_setting('issue_atlas.approver', true)), '');
    reason constant text := 'contracts/cards 승인(S15P31C108-159 운영 첫 승인 · -282 결과별 판단 문장). '
        || '기준: 대표 결정 2026-11-01(회사 노션 「2주 개발 플랜」 표 1 결정 2 · 3 · 4 · 5) '
        || '+ 세부 해석 2026-11-02(P5 최동준) + 「오류」 페이지 결정 3(2026-11-06, Figma ① 판단 문장). 값: contracts/cards';
    i record;
    c record;
    rev bigint;
BEGIN
    IF approver IS NULL THEN
        RAISE EXCEPTION '승인자가 없다. SET issue_atlas.approver = ''<관리자 로그인 이메일>'' 을 먼저 실행한다';
    END IF;

    -- 지표 사전. 카드가 승인될 때 approve_card 가 그 카드가 넣은 지표를 verified 로 바꾼다
    FOR i IN SELECT * FROM (VALUES
        ('population_net_migration_19_39', 'C1', NULL::text, NULL::text, NULL::text,
         $json${
           "id": "population_net_migration_19_39",
           "label": "청년(19–39세) 순이동",
           "unit": "명",
           "period_type": "M",
           "place_level": "sigungu",
           "roll": {"method": "sum", "min_months": 12},
           "value_direction": "음수 = 순유출, 양수 = 순유입. 전입 − 전출",
           "source": {"spec_id": "SP01", "c1_indicator_id": "population_net_migration", "locator": {"C3": "905"}},
           "cards": ["C1"],
           "added_by_card": "C1"
         }$json$::jsonb,
         $json${
           "rule_id": "net_migration_trend",
           "formula_version": "c1-net-migration-0.1",
           "indicator_id": "population_net_migration_19_39",
           "min_years": 3,
           "thresholds": {},
           "outcomes": [
             {
               "when": "fewer_than_min_years",
               "label": "근거 부족",
               "claim": "insufficient",
               "meaning": "연 값(12개월이 모두 있는 해)이 3개 미만. 연 값이 없는 해는 건너뛰고 남은 해를 순서대로 본다"
             },
             {
               "when": "all_negative_abs_increasing",
               "label": "청년 순유출 확대",
               "claim": "increasing",
               "meaning": "모든 해가 음수이고 절대값이 해마다 커짐(같으면 아님)",
               "claim_text": "{지역} 청년(19–39세) 순유출은 {첫해}년 {첫값}명에서 {끝해}년 {끝값}명으로 매년 커졌습니다."
             },
             {
               "when": "all_negative_abs_decreasing",
               "label": "청년 순유출 축소",
               "claim": "decreasing",
               "meaning": "모든 해가 음수이고 절대값이 해마다 작아짐(같으면 아님)",
               "claim_text": "{지역} 청년(19–39세) 순유출은 {첫해}년 {첫값}명에서 {끝해}년 {끝값}명으로 매년 줄었습니다."
             },
             {
               "when": "turned_positive",
               "label": "순유입 전환",
               "claim": "decreasing",
               "meaning": "앞선 해 가운데 음수가 있고 마지막 해가 양수. 모두 양수면 해당 없음",
               "claim_text": "{지역} 청년(19–39세) 순이동은 앞선 해의 순유출과 달리 {끝해}년 {끝값}명 순유입으로 바뀌었습니다."
             },
             {
               "when": "otherwise",
               "label": "불분명",
               "claim": "unclear",
               "meaning": "위 어느 것도 아님(같은 값, 오르내림, 모두 양수). 0 은 음수도 양수도 아니다. 변화 폭 임계는 없다",
               "claim_text": "{지역} 청년(19–39세) 순이동은 {기간} 변화 방향이 분명하지 않습니다."
             }
           ]
         }$json$::jsonb),
        ('population_net_migration_19_34', NULL::text, NULL::text, NULL::text, NULL::text,
         $json${
           "id": "population_net_migration_19_34",
           "label": "청년(19–34세) 순이동",
           "unit": "명",
           "period_type": "M",
           "place_level": "sigungu",
           "roll": {"method": "sum", "min_months": 12},
           "value_direction": "음수 = 순유출, 양수 = 순유입. 전입 − 전출",
           "source": {"spec_id": "SP01", "c1_indicator_id": "population_net_migration", "locator": {"C3": "901"}},
           "cards": []
         }$json$::jsonb,
         NULL::jsonb),
        ('population_net_migration_total', NULL::text, NULL::text, NULL::text, NULL::text,
         $json${
           "id": "population_net_migration_total",
           "label": "전체 순이동",
           "unit": "명",
           "period_type": "M",
           "place_level": "sigungu",
           "roll": {"method": "sum", "min_months": 12},
           "value_direction": "음수 = 순유출, 양수 = 순유입. 전입 − 전출",
           "source": {"spec_id": "SP01", "c1_indicator_id": "population_net_migration", "locator": {"C3": "000"}},
           "cards": []
         }$json$::jsonb,
         NULL::jsonb),
        ('population_movers', 'C1', NULL::text, NULL::text, NULL::text,
         $json${
           "id": "population_movers",
           "label": "전출지 → 전입 시도 이동자 수 (전연령)",
           "unit": "명",
           "period_type": "M",
           "place_level": "sigungu",
           "roll": {"method": "sum", "min_months": 12},
           "value_direction": "이동자 수. 방향 판정에 쓰지 않는다",
           "source": {"spec_id": "SP02", "c1_indicator_id": "population_movers", "locator": {}},
           "cards": ["C1"],
           "added_by_card": "C1"
         }$json$::jsonb,
         NULL::jsonb),
        ('population_registered_total', 'C1', NULL::text, NULL::text, NULL::text,
         $json${
           "id": "population_registered_total",
           "label": "주민등록인구 (연말)",
           "unit": "명",
           "period_type": "Y",
           "place_level": "sigungu",
           "roll": {"method": "end_of_period"},
           "value_direction": "인구 수",
           "source": {"spec_id": "SP10", "c1_indicator_id": "population_registered", "locator": {"C2": "000"}},
           "cards": ["C1", "A3"],
           "added_by_card": "C1"
         }$json$::jsonb,
         NULL::jsonb),
        ('population_registered_19_39', 'C1', NULL::text, NULL::text, NULL::text,
         $json${
           "id": "population_registered_19_39",
           "label": "청년(19–39세) 주민등록인구 (연말)",
           "unit": "명",
           "period_type": "Y",
           "place_level": "sigungu",
           "roll": {"method": "end_of_period"},
           "value_direction": "인구 수. 19–39세 각 나이(observation population_registered_19 – _39) 값의 합",
           "source": {
             "spec_id": "SP10",
             "c1_indicator_id": "population_registered",
             "locator": {
               "C2": [
                 "1005",
                 "1201",
                 "1202",
                 "1203",
                 "1204",
                 "1205",
                 "1301",
                 "1302",
                 "1303",
                 "1304",
                 "1305",
                 "1501",
                 "1502",
                 "1503",
                 "1504",
                 "1505",
                 "1601",
                 "1602",
                 "1603",
                 "1604",
                 "1605"
               ]
             }
           },
           "cards": ["C1"],
           "added_by_card": "C1",
           "target": "청년 19–39세"
         }$json$::jsonb,
         NULL::jsonb),
        ('population_youth_share_19_39', 'C1', 'population_registered_19_39', 'population_registered_total', NULL::text,
         $json${
           "id": "population_youth_share_19_39",
           "label": "청년(19–39세) 인구 비율",
           "unit": "%",
           "period_type": "Y",
           "place_level": "sigungu",
           "roll": {"method": "end_of_period"},
           "value_direction": "클수록 청년 비중이 크다. 19–39세 주민등록인구 ÷ 전체 주민등록인구 × 100",
           "source": {"spec_id": "SP10", "c1_indicator_id": "population_registered", "locator": {}},
           "cards": ["C1"],
           "added_by_card": "C1",
           "target": "청년 19–39세",
           "shape": "ratio",
           "numerator_id": "population_registered_19_39",
           "denominator_id": "population_registered_total",
           "multiplier": 100
         }$json$::jsonb,
         NULL::jsonb),
        ('air_pm25', 'A3', NULL::text, NULL::text, NULL::text,
         $json${
           "id": "air_pm25",
           "label": "초미세먼지(PM2.5) 월평균",
           "unit": "µg/m³",
           "period_type": "M",
           "place_level": "station",
           "roll": {"method": "mean", "min_months": 9},
           "value_direction": "클수록 나쁨. 월평균은 유효 시간 75% 이상인 달만 있다(air_monthly.value_mean)",
           "source": {"spec_id": "airkorea_final_yeosu_gwangju", "c1_indicator_id": "air_pm25", "locator": {}},
           "cards": ["A3"],
           "added_by_card": "A3"
         }$json$::jsonb,
         $json${
           "rule_id": "first_last_diff",
           "formula_version": "a3-pm25-diff-0.2",
           "indicator_id": "air_pm25",
           "min_years": 3,
           "thresholds": {"worse": 3.0, "better": -3.0, "unit": "µg/m³"},
           "outcomes": [
             {
               "when": "fewer_than_min_years",
               "label": "근거 부족",
               "claim": "insufficient",
               "meaning": "측정소 연평균이 하나라도 있는 해가 3개 미만. 측정소가 하나도 없는 해는 건너뛰고 남은 해를 본다"
             },
             {
               "when": "no_common_station",
               "label": "비교 불가",
               "claim": "not_comparable",
               "meaning": "남은 모든 해에 연평균이 있는 측정소가 없음",
               "claim_text": "{지역}에는 {기간} 모든 해에 연평균이 있는 측정소가 없어 초미세먼지(PM2.5) 연평균을 비교할 수 없습니다."
             },
             {
               "when": "diff_at_least_worse",
               "label": "악화",
               "claim": "increasing",
               "meaning": "공통 측정소 평균으로 끝해 − 첫해 연평균이 +3µg/m³ 이상",
               "claim_text": "{지역} 측정소 {n}곳의 초미세먼지(PM2.5) 연평균은 {첫해}년 {첫값}µg/m³에서 {끝해}년 {끝값}µg/m³로 높아졌습니다."
             },
             {
               "when": "diff_at_most_better",
               "label": "개선",
               "claim": "decreasing",
               "meaning": "공통 측정소 평균으로 끝해 − 첫해 연평균이 −3µg/m³ 이하",
               "claim_text": "{지역} 측정소 {n}곳의 초미세먼지(PM2.5) 연평균은 {첫해}년 {첫값}µg/m³에서 {끝해}년 {끝값}µg/m³로 낮아졌습니다."
             },
             {
               "when": "otherwise",
               "label": "불분명",
               "claim": "unclear",
               "meaning": "−3 과 +3 사이(경계값은 악화 · 개선)",
               "claim_text": "{지역} 측정소 {n}곳의 초미세먼지(PM2.5) 연평균은 {첫해}년 {첫값}µg/m³, {끝해}년 {끝값}µg/m³로 차이가 판정 기준(±3µg/m³)보다 작습니다."
             }
           ]
         }$json$::jsonb)
    ) AS v(indicator_id, added_by_card, numerator_id, denominator_id, base_id, definition, rule) LOOP
        IF NOT EXISTS (SELECT FROM indicator WHERE indicator_id = i.indicator_id) THEN
            INSERT INTO indicator(indicator_id, definition, rule, numerator_id, denominator_id, base_id,
                                  added_by_card, updated_by)
            VALUES (i.indicator_id, i.definition, i.rule, i.numerator_id, i.denominator_id, i.base_id,
                    i.added_by_card, approver);
        ELSIF EXISTS (SELECT FROM indicator WHERE indicator_id = i.indicator_id
                      AND (definition, numerator_id, denominator_id, base_id, added_by_card)
                          IS DISTINCT FROM (i.definition, i.numerator_id, i.denominator_id, i.base_id,
                                            i.added_by_card)) THEN
            RAISE EXCEPTION '지표 % 가 DB 와 seed 에서 다르다. 어느 쪽이 맞는지 확인한 뒤 다시 실행한다', i.indicator_id;
        ELSIF EXISTS (SELECT FROM indicator WHERE indicator_id = i.indicator_id
                      AND rule IS DISTINCT FROM i.rule) THEN
            -- 판정 규칙은 카드 계약이 원본이다. 정의가 같고 규칙만 다르면 계약 값으로 고치고(rule_version 이 오른다),
            -- 아래에서 그 규칙을 쓰는 카드를 다음 판으로 승인한다
            UPDATE indicator SET rule = i.rule, updated_by = approver WHERE indicator_id = i.indicator_id;
            RAISE NOTICE '지표 % 의 규칙을 계약 값으로 고쳤다', i.indicator_id;
        END IF;
    END LOOP;

    -- legacy v1 다음인 v2 가 첫 승인본이다(C3). 승인본이 계약(초안 칸 · 주 지표 규칙)과 같으면 건너뛴다
    FOR c IN SELECT * FROM (VALUES
        ('C1',
         $json${
           "name": "청년 유출·정착",
           "parent_question": "청년은 어디로 떠나고, 지역은 어떻게 늙어가는가?",
           "domain": "C 인구·지역소멸",
           "st_type": ["변화형", "이동형"],
           "inclusion": ["청년 전입·전출 통계", "청년 인구 비율 변화", "청년 유출·정착·귀향 기사·보도", "청년 주거·정착 지원 사업"],
           "exclusion": ["청년 일자리 수(F3)", "대학 진학 이동(E)", "관광객 유입(F5)", "전체 인구 감소(C2)"],
           "claim_template": "{지역}에서 {기간} 청년(19–39세) 순이동이 {판정값}",
           "claim_items": [
             {"indicator_id": "population_net_migration_19_39", "role": "main"},
             {"indicator_id": "population_movers", "role": "related"}
           ],
           "comparability": {
             "same_indicator": "지표 사전의 같은 행(population_net_migration_19_39). 19–34세 · 전체 순이동으로 바꿔 채우지 않는다",
             "same_period_length": "연 = 1–12월 합. 12개월이 모두 있는 해만 연 값이 있다",
             "same_boundary": "같은 place_id. 2026-07-01 코드 개편(46130 → 12130)은 place_code_map 으로 같은 place_id",
             "same_method": "전입 − 전출, 19–39세 밴드 고정"
           },
           "max_claim_level": "calculated",
           "applicability": {"place_level": "sigungu", "min_complete_years": 3, "population": "청년 19–39세"},
           "evidence": {
             "statistics": [
               {"spec_id": "SP01", "indicator_id": "population_net_migration_19_39"},
               {
                 "spec_id": "SP10",
                 "indicator_id": "population_youth_share_19_39",
                 "note": "청년 인구 비율(포함 기준 「청년 인구 비율 변화」). 판정에는 쓰지 않는 맥락"
               }
             ],
             "documents": [
               {"spec_id": "bigkinds_news_yeosu_gwangju", "note": "빅카인즈 기사. 본문은 요약 · 분류 뒤 폐기(2026-11-01 결정)"},
               {"spec_id": "press_release_yeosu", "note": "여수시 보도자료 목록(제목 · 등록일 · 링크). 공공누리 4유형이라 본문 없음"},
               {
                 "spec_id": "press_release_gwangju",
                 "note": "광주광역시 보도자료 목록. 공공누리 표시 없음(협의 전)이라 본문 없음. 발행 기관 지역은 시 전체(29)"
               }
             ],
             "existing_responses": [
               {"spec_id": "youthcenter_policy_yeosu_gwangju", "note": "온통청년 청년정책 → existing_response"},
               {
                 "spec_id": "lofin_expenditure_gwangju_yeosu",
                 "note": "지방재정365 세출 최신본(local_expenditure_latest) → existing_response"
               }
             ],
             "denominators": [
               {
                 "spec_id": "SP10",
                 "indicator_id": "population_registered_19_39",
                 "note": "19–39세 순이동률의 분모 · 청년 인구 비율의 분자"
               },
               {
                 "spec_id": "SP10",
                 "indicator_id": "population_registered_total",
                 "note": "맥락 표시 · 청년 인구 비율의 분모"
               }
             ]
           },
           "expected_gaps": [{"what": "민원", "status": "license_blocked"}, {"what": "읍면동 순이동", "status": "not_published"}],
           "required_for_claim": {
             "statistics": "required",
             "documents": "optional",
             "existing_responses": "optional",
             "denominators": "optional"
           },
           "warrant": {
             "status": "draft",
             "text": "청년 순유출이 여러 해 지속되면 그 지역의 청년 정착 기반이 약해지고 있다고 본다. 순이동은 정착 여부를 직접 재는 유일한 공식 지표다"
           },
           "rebuttals": {
             "status": "draft",
             "items": [
               {"id": "C1-R1", "text": "대학 진학 · 군 입대 연령의 구조적 전출(19–24세가 지배하는가)"},
               {"id": "C1-R2", "text": "통계 기준 변경(7/1 개편, 주민등록 정비)"},
               {"id": "C1-R3", "text": "산단 · 대형 사업장 고용 변동에 따른 일시 전입 · 전출"},
               {"id": "C1-R4", "text": "코로나 이후 이동 회복"}
             ]
           },
           "ceiling": ["떠난 이유", "행선지 해석", "정책 효과", "향후 추세", "타 지역과 우열"],
           "map_mode": "시계열만(시군구). 이동은 그림만, 판정 없음",
           "legend_text": ["집계 이동량, 이동 경로 아님", "첫 관측 순서, 옮겨 간 경로·원인 아님"],
           "forbidden_terms": ["확산", "전파", "원인", "효과", "소멸", "탈여수"],
           "keywords": ["청년 유출", "청년 순유출", "청년 정착", "청년 주거지원", "청년 귀향", "인구 감소", "전입 전출", "청년 유입"],
           "approval": {
             "approved_by": "대표",
             "approved_at": "2026-11-01",
             "approved_fields": ["claim_items", "rule", "applicability", "required_for_claim", "ceiling", "legend_text"],
             "source": "회사 노션 「Issue Atlas — 5차 멘토링 검토 및 2주 개발 플랜 (11/2 ~ 11/13)」 표 1 결정 2 · 4 · 5"
           }
         }$json$::jsonb),
        ('A3',
         $json${
           "name": "대기질",
           "parent_question": "도시의 생태환경은 어디서, 얼마나 빠르게 변화하는가?",
           "domain": "A 환경·기후",
           "st_type": ["분포형", "변화형"],
           "inclusion": ["측정소 PM2.5 · O3 관측값", "나쁨 일수", "비상저감조치", "대기 개선 사업"],
           "exclusion": ["악취 민원(측정 불가, 후속 카드)", "화학사고(B4)"],
           "claim_template": "{지역}의 측정소 {n}곳에서 {기간} 초미세먼지(PM2.5) 연평균이 {판정값}",
           "claim_items": [{"indicator_id": "air_pm25", "role": "main"}],
           "comparability": {
             "same_indicator": "지표 사전의 같은 행(air_pm25), 같은 측정소(station_code)",
             "same_period_length": "연. 측정소 연평균은 유효한 달(유효 시간 75% 이상) 9개 이상일 때만",
             "same_boundary": "시군구 안 측정소 가운데 기간 안 모든 해에 연평균이 있는 측정소(공통 측정소)만 쓴다. 이전 · 교체가 확인된 측정소는 이전 전후를 다른 측정소로 본다",
             "same_method": "시군구 연 값 = 공통 측정소별 연평균의 평균. 판단 문장의 {n} 은 공통 측정소 수"
           },
           "max_claim_level": "calculated",
           "applicability": {"place_level": "sigungu", "min_complete_years": 3, "min_stations": 1},
           "evidence": {
             "statistics": [{"spec_id": "airkorea_final_yeosu_gwangju", "indicator_id": "air_pm25"}],
             "documents": [
               {"spec_id": "bigkinds_news_yeosu_gwangju", "note": "빅카인즈 기사. 본문은 요약 · 분류 뒤 폐기(2026-11-01 결정)"},
               {"spec_id": "press_release_yeosu", "note": "여수시 보도자료 목록(제목 · 등록일 · 링크). 공공누리 4유형이라 본문 없음"},
               {
                 "spec_id": "press_release_gwangju",
                 "note": "광주광역시 보도자료 목록. 공공누리 표시 없음(협의 전)이라 본문 없음. 발행 기관 지역은 시 전체(29)"
               }
             ],
             "existing_responses": [
               {
                 "spec_id": "lofin_expenditure_gwangju_yeosu",
                 "note": "지방재정365 세출 최신본(local_expenditure_latest) 환경보호 대기 → existing_response"
               }
             ],
             "denominators": [{"spec_id": "SP10", "indicator_id": "population_registered_total", "note": "노출 인구 맥락 표시만"}]
           },
           "expected_gaps": [
             {"what": "기상 자료(강수 · 풍향)", "status": "not_collected"},
             {"what": "확정자료 최근 2개월", "status": "not_published"}
           ],
           "required_for_claim": {
             "statistics": "required",
             "documents": "optional",
             "existing_responses": "optional",
             "denominators": "optional"
           },
           "warrant": {
             "status": "draft",
             "text": "같은 측정소에서 PM2.5 연평균과 나쁨 일수가 늘면 그 지점 주변의 대기질이 나빠졌다고 본다. 측정소 값은 반경 수 km의 대표값이며 도시 전체를 대표하지 않는다"
           },
           "rebuttals": {
             "status": "draft",
             "items": [
               {"id": "A3-R1", "text": "기상 변동(강수일 · 풍향 · 정체)"},
               {"id": "A3-R2", "text": "국외 유입(황사 · 장거리 이동)"},
               {"id": "A3-R3", "text": "측정소 이전 · 장비 교체 · 결측 시간 편차"},
               {"id": "A3-R4", "text": "등급 기준값 개정"}
             ]
           },
           "ceiling": ["발생원", "건강 영향", "정책 효과", "기상 요인 분리", "측정소 없는 지역으로 일반화"],
           "map_mode": "측정소 점 + 월 슬라이더. 값은 점 색, 선 없음",
           "legend_text": ["측정소 값, 도시 평균 아님", "첫 관측 순서, 옮겨 간 경로·원인 아님"],
           "forbidden_terms": ["확산", "전파", "원인", "효과", "소멸", "오염 유입", "배출원"],
           "keywords": ["미세먼지", "초미세먼지", "오존", "대기질", "비상저감조치", "고농도", "산단 대기"],
           "approval": {
             "approved_by": "대표",
             "approved_at": "2026-11-01",
             "approved_fields": ["claim_items", "rule", "applicability", "required_for_claim", "ceiling", "legend_text"],
             "source": "회사 노션 「Issue Atlas — 5차 멘토링 검토 및 2주 개발 플랜 (11/2 ~ 11/13)」 표 1 결정 3 · 4 · 5"
           }
         }$json$::jsonb)
    ) AS v(card_id, spec) LOOP
        IF EXISTS (
            SELECT FROM card k
            JOIN card_version v ON v.card_id = k.card_id AND v.version = k.card_version
            JOIN indicator m ON m.indicator_id = v.spec->'rule'->>'indicator_id'
            WHERE k.card_id = c.card_id AND k.status = 'card'
              AND (v.spec->'rule') - 'rule_version' - 'indicator_id' = m.rule - 'indicator_id'
              -- 승인 때 보증 · 반박의 status 만 approved 로 바뀐다
              AND NOT EXISTS (
                  SELECT FROM jsonb_each(c.spec) d(key, value)
                  WHERE CASE WHEN d.key IN ('warrant', 'rebuttals') THEN (v.spec->d.key) - 'status'
                             ELSE v.spec->d.key END
                        IS DISTINCT FROM
                        CASE WHEN d.key IN ('warrant', 'rebuttals') THEN d.value - 'status' ELSE d.value END)
        ) THEN
            RAISE NOTICE '% 는 승인본이 계약과 같아 건너뛴다', c.card_id;
            CONTINUE;
        END IF;
        UPDATE card SET draft_spec = c.spec || jsonb_build_object('author', approver),
                        draft_revision = draft_revision + 1, updated_by = approver, updated_at = now()
            WHERE card_id = c.card_id RETURNING draft_revision INTO rev;
        IF NOT FOUND THEN
            RAISE EXCEPTION '카드 % 가 없다(V0013)', c.card_id;
        END IF;
        PERFORM approve_card(c.card_id, approver, rev, reason);
    END LOOP;
END $seed$;
