package com.c108.issueatlas.question.service;

import com.c108.issueatlas.question.client.ArgumentEngineClient.Reply;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Predicate;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * 같은 문장화 입력이면 engine(LLM)을 다시 부르지 않고 앞 결과를 쓴다(S15P31C108-261). 키는 문장화 요청에서 실행마다 바뀌는 값(run_id ·
 * question_id)을 뺀 JSON 의 SHA-256 이라, 근거 · 기사 · 카드 승인본 중 하나라도 바뀌면 다른 키가 된다. 다시 써도 되는 결과(done)만 담고,
 * 실패 · 시간 초과 · 건너뜀은 담지 않아 다음 질문이 다시 부른다. 같은 키가 동시에 오면 처음 요청만 engine 을 부르고 나머지는 그 결과를 같이 받는다.
 */
// ponytail: 서버 한 대 메모리(재시작하면 비움). engine 의 프롬프트 · 모델이 바뀌어도 유효기간까지는 앞 결과를 쓴다
@Component
public class PhrasingCache {
    private final int maxEntries;
    private final Duration ttl;
    private final Clock clock;
    private final Map<String, Entry> entries;
    private final Map<String, CompletableFuture<Reply>> running = new ConcurrentHashMap<>();

    @Autowired
    public PhrasingCache(
            @Value("${issue-atlas.engine.cache-size:500}") int maxEntries,
            @Value("${issue-atlas.engine.cache-ttl:24h}") Duration ttl) {
        this(maxEntries, ttl, Clock.systemUTC());
    }

    PhrasingCache(int maxEntries, Duration ttl, Clock clock) {
        this.maxEntries = maxEntries;
        this.ttl = ttl;
        this.clock = clock;
        this.entries =
                new LinkedHashMap<>(16, 0.75f, true) {
                    @Override
                    protected boolean removeEldestEntry(Map.Entry<String, Entry> eldest) {
                        return size() > maxEntries;
                    }
                };
    }

    /**
     * 캐시에 있으면 그 결과, 같은 요청이 진행 중이면 그 결과를 기다려 받고, 아니면 engine 을 부른다. reusable 을 통과한 결과만 담는다.
     * maxEntries 가 0 이하이면 늘 engine 을 부른다.
     */
    public Lookup get(ObjectNode request, Supplier<Reply> engine, Predicate<Reply> reusable) {
        if (maxEntries <= 0) {
            return new Lookup(engine.get(), Source.ENGINE);
        }
        String key = key(request);
        Reply hit = cached(key);
        if (hit != null) {
            return new Lookup(hit, Source.CACHE);
        }
        CompletableFuture<Reply> mine = new CompletableFuture<>();
        CompletableFuture<Reply> other = running.putIfAbsent(key, mine);
        if (other != null) {
            return new Lookup(other.join(), Source.SHARED);
        }
        try {
            // 앞 요청이 방금 끝내고 담았으면 그것을 쓴다
            hit = cached(key);
            Reply reply = hit != null ? hit : engine.get();
            if (hit == null && reusable.test(reply)) {
                put(key, reply);
            }
            mine.complete(reply);
            return new Lookup(reply, hit != null ? Source.CACHE : Source.ENGINE);
        } catch (RuntimeException | Error e) {
            mine.completeExceptionally(e);
            throw e;
        } finally {
            running.remove(key, mine);
        }
    }

    public synchronized void clear() {
        entries.clear();
    }

    /** 실행마다 새로 만드는 run_id · question_id 를 뺀 요청. 나머지는 같은 코드가 같은 순서로 만들므로 문자열이 같다. */
    static String key(ObjectNode request) {
        ObjectNode copy = request.deepCopy();
        JsonNode judgment = copy.get("judgment");
        if (judgment instanceof ObjectNode j) {
            j.remove("run_id");
            if (j.get("question") instanceof ObjectNode question) {
                question.remove("question_id");
            }
        }
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(copy.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private synchronized Reply cached(String key) {
        Entry entry = entries.get(key);
        if (entry == null) {
            return null;
        }
        if (!clock.instant().isBefore(entry.expires())) {
            entries.remove(key);
            return null;
        }
        return entry.reply();
    }

    private synchronized void put(String key, Reply reply) {
        entries.put(key, new Entry(reply, clock.instant().plus(ttl)));
    }

    private record Entry(Reply reply, Instant expires) {}

    /** 결과와 어디서 왔는지(engine 을 불렀다 · 캐시 · 동시에 온 같은 요청의 결과를 같이 받음). */
    public record Lookup(Reply reply, Source source) {}

    public enum Source {
        ENGINE,
        CACHE,
        SHARED
    }
}
