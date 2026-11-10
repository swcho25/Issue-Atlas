package com.c108.issueatlas.card.repository;

/**
 * 근거 고르기 SQL — 질문 실행(근거 행을 만든다)과 카드 목록 ②(저장하지 않고 센다)가 같이 쓴다. 한쪽만 고치면 두 화면의 근거 상태가 어긋난다. 파라미터:
 * {@code :card · :place · :start · :end}, 보도자료는 {@code :specs · :keywords} 도.
 */
public final class EvidenceMatchSql {
    /**
     * -136 기존 대응 후보 중 이 카드 · 지역 · 기간에 맞는 현재 판. 세출은 회계연도, 온통청년은 사업 기간이 겹치는지 본다. 기간을 모르는 후보와
     * 광역(place_id null) 후보는 고르지 않는다.
     */
    public static final String RESPONSES =
            """
            SELECT r.* FROM existing_response r
            WHERE r.is_current AND r.card_id = :card AND r.place_id = :place
              AND CASE WHEN r.origin = 'lofin'
                    THEN daterange(make_date(r.fiscal_year, 1, 1), make_date(r.fiscal_year + 1, 1, 1))
                    ELSE daterange(r.period_start, r.period_end) END && daterange(:start, :end)
              AND (r.origin = 'lofin' OR r.period_start IS NOT NULL OR r.period_end IS NOT NULL)
            """;

    /**
     * 정제된 보도자료(C1 문서 kind = press_release) 가운데 카드 문서 명세 · 질문 지역 · 기간 · 키워드에 맞는 글. 발행 기관
     * 지역(place_code_raw)이 질문 place 와 같아야 한다 — 광주광역시(시 전체 kr-29) 글은 구 질문에 잇지 않는다. 키워드는 띄어쓰기로 나눈 낱말이
     * 제목에 모두 있으면 맞다. 출처 등급이 없는 출처는 뺀다.
     */
    public static final String PRESS =
            """
            WITH keyword AS (
                SELECT regexp_split_to_array(btrim(k), '\\s+') AS words
                FROM unnest(ARRAY[:keywords]::text[]) k WHERE btrim(k) <> ''
            )
            SELECT 'ev_doc_' || md5(n.obs_key || '|' || n.content_hash) AS evidence_id,
                   n.record -> 'document' ->> 'title' AS title, n.source_id, s.reliability_grade,
                   n.record ->> 'license_type' AS license_type, n.storage_scope,
                   (n.record ->> 'published_at')::timestamptz AS published_at,
                   (n.record ->> 'collected_at')::timestamptz AS collected_at,
                   n.record -> 'document' ->> 'link' AS url,
                   jsonb_build_object('spec_id', n.spec_id, 'locator', n.record -> 'locator',
                                      'obs_key', n.obs_key, 'content_hash', n.content_hash) AS locator,
                   (SELECT string_agg(array_to_string(kw.words, ' '), ', ') FROM keyword kw
                    WHERE NOT EXISTS (
                        SELECT 1 FROM unnest(kw.words) w
                        WHERE strpos(n.record -> 'document' ->> 'title', w) = 0)) AS matched_keywords
            FROM normalized_ready n
            JOIN place_code_map m ON m.code_system = n.place_code_system AND m.place_code = n.place_code_raw
            JOIN source s ON s.source_id = n.source_id
            WHERE n.spec_id IN (:specs) AND n.record -> 'document' ->> 'kind' = 'press_release'
              AND m.place_id = :place AND s.reliability_grade IS NOT NULL
              AND (n.record ->> 'published_at')::timestamptz
                  >= CAST(:start AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
              AND (n.record ->> 'published_at')::timestamptz
                  < CAST(:end AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
              AND EXISTS (
                  SELECT 1 FROM keyword kw
                  WHERE NOT EXISTS (
                      SELECT 1 FROM unnest(kw.words) w
                      WHERE strpos(n.record -> 'document' ->> 'title', w) = 0))
            """;

    /** 분모 지표(:indicator)에 질문 지역 · 기간의 available 관측 행이 있는가. 없으면 분모 근거를 만들지 않는다. */
    public static final String DENOMINATOR_OBSERVED =
            """
            EXISTS (
                SELECT 1 FROM observation o
                WHERE o.what_type = 'indicator' AND o.what_id = :indicator
                  AND o.place_id = :place AND o.status = 'available'
                  AND o.when_start >= CAST(:start AS date)::timestamp AT TIME ZONE 'Asia/Seoul'
                  AND o.when_start < CAST(:end AS date)::timestamp AT TIME ZONE 'Asia/Seoul')
            """;

    private EvidenceMatchSql() {}
}
