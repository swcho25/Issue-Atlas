package com.c108.issueatlas.place.repository;

import java.time.LocalDate;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** place 는 PostGIS geography 칸이 있어 JPA 엔티티 대신 SQL 로 읽는다. */
@Repository
public class PlaceRepository {
    // 지역 하나에 코드 여러 줄. 코드가 없는 지역은 code_system 이 null 인 한 줄.
    // 지역 순서는 옛 KOSIS 코드 순(광주 동·서·남·북·광산구, 여수시). 새 코드는 여수가 가장 작아 쓰지 않는다.
    // 코드는 KOSIS 만 내보낸다(C2 place-list). 수집 출처별 코드(온통청년 bjd 등, V0018)는 지역을 잇는 데만 쓴다
    private static final String REGION_CODES =
            """
            SELECT p.place_id, p.name, p.level, p.parent_id,
                   c.code_system, c.place_code, c.valid_from, c.valid_to
            FROM place p LEFT JOIN place_code_map c ON c.place_id = p.place_id AND c.code_system = 'kosis'
            WHERE p.level NOT IN ('station', 'sido')
            ORDER BY min(c.place_code) FILTER (WHERE c.code_system = 'kosis' AND c.valid_from IS NULL)
                         OVER (PARTITION BY p.place_id) NULLS LAST,
                     p.place_id,
                     c.valid_from NULLS FIRST, c.code_system, c.place_code
            """;

    private final JdbcClient jdbc;

    public PlaceRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 측정소(station)는 지도 점이라 지역 목록에 넣지 않는다. 시도(sido, V0018)는 이동 도착지 · 넓은 지역 기사의 대표점이지 고르는 지역이 아니라서 넣지
     * 않는다.
     */
    public List<RegionCodeRow> findRegionCodes() {
        return jdbc.sql(REGION_CODES).query(RegionCodeRow.class).list();
    }

    public record RegionCodeRow(
            String placeId,
            String name,
            String level,
            String parentId,
            String codeSystem,
            String placeCode,
            LocalDate validFrom,
            LocalDate validTo) {}
}
