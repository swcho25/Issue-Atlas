package com.c108.issueatlas.card;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/**
 * V0053 card_rebuttal_profile(S15P31C108-326): 승인 카드 판의 반박 후보마다 검색 질의 벡터를 두고, (카드, 반박)마다 활성 질의는
 * 하나뿐이며 없는 카드 판은 받지 않는다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class CardRebuttalProfileMigrationTest {
    static final String HASH = "a".repeat(64);

    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void cards() throws Exception {
        jdbc.queryForObject(
                "SELECT set_config('issue_atlas.approver', ?, true)",
                String.class,
                "admin@seed.test");
        jdbc.execute(Files.readString(Path.of("db/seed/cards-c1-a3.sql")));
    }

    @Test
    void 승인본_반박마다_질의_벡터_하나를_활성으로_둔다() {
        // embed-cards 가 만드는 것처럼 승인 판의 rebuttals.items 마다 한 행
        int inserted =
                jdbc.update(
                        "INSERT INTO card_rebuttal_profile(card_id,card_version,rebuttal_id,query_version,"
                                + "query_text,query_hash,model,embedding,is_active)"
                                + " SELECT c.card_id, c.current_version, item->>'id', 'rebuttal-query-v1',"
                                + " c.name || '의 다른 설명: ' || (item->>'text'),"
                                + " encode(sha256(convert_to(item->>'text', 'UTF8')), 'hex'),"
                                + " 'gemini-embedding-2', array_fill(0.01::real, ARRAY[1536])::vector, true"
                                + " FROM card c JOIN card_version v"
                                + "   ON v.card_id = c.card_id AND v.version = c.current_version,"
                                + " jsonb_array_elements(v.spec->'rebuttals'->'items') item");
        assertThat(inserted).isEqualTo(8);
        assertThat(
                        jdbc.queryForList(
                                "SELECT rebuttal_id FROM card_rebuttal_profile WHERE is_active"
                                        + " ORDER BY rebuttal_id",
                                String.class))
                .containsExactly(
                        "A3-R1", "A3-R2", "A3-R3", "A3-R4", "C1-R1", "C1-R2", "C1-R3", "C1-R4");
    }

    @Test
    void 같은_반박의_두_번째_활성_질의와_잘못된_행은_막는다() {
        insert("C1", "current_version", "C1-R1", "rebuttal-query-v1", HASH, true);
        // 다른 질의 판은 꺼진 채로는 함께 둘 수 있다
        insert("C1", "current_version", "C1-R1", "rebuttal-query-v0", HASH, false);
        rejected(
                "uq_card_rebuttal_profile_active",
                () -> insert("C1", "current_version", "C1-R1", "rebuttal-query-v2", HASH, true));
        rejected(
                "card_rebuttal_profile_card_id_card_version_fkey",
                () ->
                        insert(
                                "C1",
                                "current_version + 99",
                                "C1-R1",
                                "rebuttal-query-v1",
                                HASH,
                                false));
        rejected(
                "card_rebuttal_profile_rebuttal_id_check",
                () -> insert("C1", "current_version", " ", "rebuttal-query-v1", HASH, false));
        rejected(
                "card_rebuttal_profile_query_hash_check",
                () ->
                        insert(
                                "C1",
                                "current_version",
                                "C1-R2",
                                "rebuttal-query-v1",
                                "sha256:x",
                                false));
    }

    /** version 은 card 표 기준 SQL 식(예: current_version). */
    private void insert(
            String card,
            String version,
            String rebuttal,
            String queryVersion,
            String hash,
            boolean active) {
        jdbc.update(
                "INSERT INTO card_rebuttal_profile(card_id,card_version,rebuttal_id,query_version,"
                        + "query_text,query_hash,model,embedding,is_active)"
                        + " SELECT card_id, "
                        + version
                        + ", ?, ?, '질의', ?, 'gemini-embedding-2',"
                        + " array_fill(0.01::real, ARRAY[1536])::vector, ? FROM card WHERE card_id = ?",
                rebuttal,
                queryVersion,
                hash,
                active,
                card);
    }

    /** 검사 위반은 트랜잭션을 깨뜨리므로 저장점으로 되돌린다. */
    private void rejected(String constraint, Runnable insert) {
        jdbc.execute("SAVEPOINT rebuttal_check");
        assertThatThrownBy(insert::run)
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining(constraint);
        jdbc.execute("ROLLBACK TO SAVEPOINT rebuttal_check");
    }
}
