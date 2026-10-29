-- C2 카드 목록. 판정 규칙·카드 승인은 후속 작업이며 여기서는 조회 메타만 둔다.
CREATE TABLE card (
    card_id text PRIMARY KEY,
    name text NOT NULL,
    domain text NOT NULL,
    parent_question text NOT NULL,
    card_version integer NOT NULL CHECK (card_version >= 0),
    taxonomy_version text NOT NULL
);
INSERT INTO card VALUES
    ('C1', '청년 유출·정착', 'C 인구·지역소멸', '청년은 어디로 떠나고, 지역은 어떻게 늙어가는가?', 1, 'tax-2026.10'),
    ('A3', '대기질', 'A 환경·기후', '도시의 생태환경은 어디서, 얼마나 빠르게 변화하는가?', 1, 'tax-2026.10');

-- 조회 기간 전체에 대해 P3/P4가 확정한 근거 종류별 상태. 원본 행 수와 근거 확보는 다르다.
-- 다른 기간의 상태를 겹침만으로 재사용하지 않는다. 미등록 종류는 API에서 not_collected.
CREATE TABLE card_evidence_status (
    place_id text NOT NULL REFERENCES place(place_id),
    card_id text NOT NULL REFERENCES card(card_id),
    card_version integer NOT NULL CHECK (card_version >= 0),
    period_start date NOT NULL,
    period_end date NOT NULL,
    kind text NOT NULL CHECK (kind IN ('statistics', 'documents', 'existing_responses', 'denominators')),
    status text NOT NULL CHECK (status IN ('available', 'not_published', 'not_collected', 'license_blocked', 'review_pending')),
    review_pending_count integer NOT NULL DEFAULT 0 CHECK (review_pending_count >= 0),
    PRIMARY KEY (place_id, card_id, card_version, period_start, period_end, kind),
    CHECK (period_end > period_start),
    CHECK (status <> 'review_pending' OR review_pending_count > 0)
);
