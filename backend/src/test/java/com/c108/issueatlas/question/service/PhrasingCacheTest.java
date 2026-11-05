package com.c108.issueatlas.question.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.question.client.ArgumentEngineClient.Reply;
import com.c108.issueatlas.question.service.PhrasingCache.Lookup;
import com.c108.issueatlas.question.service.PhrasingCache.Source;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** 문장화 결과 캐시(S15P31C108-261): 키 · done 만 담기 · 동시 요청 한 번 · 유효기간 · 크기. */
class PhrasingCacheTest {
    private final ObjectMapper json = JsonMapper.builder().build();
    private final MutableClock clock = new MutableClock();
    private final AtomicInteger calls = new AtomicInteger();

    private ObjectNode request(String runId, String questionId, String warrant) {
        ObjectNode request = json.createObjectNode();
        ObjectNode judgment = request.putObject("judgment");
        judgment.put("run_id", runId);
        judgment.putObject("question").put("question_id", questionId).put("place_id", "kr-12130");
        judgment.putObject("warrant").put("text", warrant);
        request.putArray("articles");
        return request;
    }

    private Reply reply(String status) {
        return new Reply(
                json.readTree(
                        "{\"status\": \""
                                + status
                                + "\", \"warrant\": {\"text\": \"w\"},"
                                + " \"rebuttals\": []}"),
                null);
    }

    private Supplier<Reply> engine(Reply reply) {
        return () -> {
            calls.incrementAndGet();
            return reply;
        };
    }

    private Lookup ask(PhrasingCache cache, ObjectNode request, Reply reply) {
        return cache.get(request, engine(reply), ArgumentPhraser::reusable);
    }

    @Test
    void sameInputWithNewRunAndQuestionIdsReusesTheDoneReply() {
        PhrasingCache cache = new PhrasingCache(10, Duration.ofHours(1), clock);
        Reply done = reply("done");

        Lookup first = ask(cache, request("run_1", "q_1", "카드 문구"), done);
        Lookup second = ask(cache, request("run_2", "q_2", "카드 문구"), reply("failed"));

        assertThat(first.source()).isEqualTo(Source.ENGINE);
        assertThat(second.source()).isEqualTo(Source.CACHE);
        assertThat(second.reply()).isSameAs(done);
        assertThat(calls).hasValue(1);
        // 입력이 하나라도 다르면 다시 부른다
        assertThat(ask(cache, request("run_3", "q_3", "다른 문구"), done).source())
                .isEqualTo(Source.ENGINE);
        assertThat(calls).hasValue(2);
    }

    @Test
    void notDoneRepliesAreNotKept() {
        PhrasingCache cache = new PhrasingCache(10, Duration.ofHours(1), clock);
        for (Reply reply :
                List.of(
                        reply("failed"),
                        reply("skipped"),
                        new Reply(null, "ENGINE_TIMEOUT"),
                        new Reply(json.readTree("{\"status\": \"done\"}"), null))) {
            ask(cache, request("run_1", "q_1", "w"), reply);
        }
        assertThat(calls).hasValue(4);
    }

    @Test
    void concurrentSameRequestsCallTheEngineOnce() throws Exception {
        PhrasingCache cache = new PhrasingCache(10, Duration.ofHours(1), clock);
        CountDownLatch entered = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        Reply done = reply("done");
        Supplier<Reply> slowEngine =
                () -> {
                    calls.incrementAndGet();
                    entered.countDown();
                    try {
                        release.await(5, TimeUnit.SECONDS);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    return done;
                };
        ExecutorService pool = Executors.newFixedThreadPool(10);
        try {
            List<Future<Lookup>> results = new ArrayList<>();
            for (int i = 0; i < 10; i++) {
                ObjectNode request = request("run_" + i, "q_" + i, "w");
                results.add(
                        pool.submit(
                                () -> cache.get(request, slowEngine, ArgumentPhraser::reusable)));
            }
            assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
            Thread.sleep(200);
            release.countDown();
            for (Future<Lookup> result : results) {
                assertThat(result.get(5, TimeUnit.SECONDS).reply()).isSameAs(done);
            }
        } finally {
            pool.shutdownNow();
        }
        // 늦게 온 요청은 캐시에서, 겹친 요청은 진행 중인 결과를 같이 받는다. 어느 쪽이든 engine 은 한 번
        assertThat(calls).hasValue(1);
    }

    @Test
    void expiredAndEvictedEntriesCallTheEngineAgain() {
        PhrasingCache cache = new PhrasingCache(2, Duration.ofHours(1), clock);
        Reply done = reply("done");
        ask(cache, request("r", "q", "a"), done);
        clock.advance(Duration.ofMinutes(59));
        assertThat(ask(cache, request("r", "q", "a"), done).source()).isEqualTo(Source.CACHE);
        clock.advance(Duration.ofMinutes(1));
        assertThat(ask(cache, request("r", "q", "a"), done).source()).isEqualTo(Source.ENGINE);

        // 크기 2: a(위에서 다시 담김) · b · c 를 담으면 가장 오래 안 쓴 a 가 빠진다
        ask(cache, request("r", "q", "b"), done);
        ask(cache, request("r", "q", "c"), done);
        assertThat(ask(cache, request("r", "q", "c"), done).source()).isEqualTo(Source.CACHE);
        assertThat(ask(cache, request("r", "q", "a"), done).source()).isEqualTo(Source.ENGINE);
    }

    @Test
    void zeroSizeTurnsTheCacheOff() {
        PhrasingCache cache = new PhrasingCache(0, Duration.ofHours(1), clock);
        ask(cache, request("r", "q", "a"), reply("done"));
        ask(cache, request("r", "q", "a"), reply("done"));
        assertThat(calls).hasValue(2);
    }

    private static final class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-05T00:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
