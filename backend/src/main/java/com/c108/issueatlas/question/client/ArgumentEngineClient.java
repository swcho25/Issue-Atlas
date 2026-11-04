package com.c108.issueatlas.question.client;

import java.net.SocketTimeoutException;
import java.net.http.HttpClient;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * engine 논증 문장화 호출(contracts/ai v0.2 「문장화」). 주소가 없으면 부르지 않는다. 실패는 예외 대신 사유 코드로 돌려주어 질문 실행이 카드 문구로
 * 계속되게 한다. 요청 · 응답 값은 로그 · 예외 메시지에 남기지 않는다.
 */
@Component
public class ArgumentEngineClient {
    private final RestClient http;
    private final ObjectMapper json;

    public ArgumentEngineClient(
            @Value("${issue-atlas.engine.url:}") String url,
            @Value("${issue-atlas.engine.timeout:40s}") Duration timeout,
            ObjectMapper json) {
        this.json = json;
        if (url.isBlank()) {
            this.http = null;
            return;
        }
        JdkClientHttpRequestFactory factory =
                new JdkClientHttpRequestFactory(
                        HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build());
        factory.setReadTimeout(timeout);
        this.http = RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }

    /** 문장화 결과(contracts/ai phrasing-result). 못 받았으면 result 는 null 이고 failure 에 사유 코드. */
    public Reply phrase(JsonNode request) {
        if (http == null) {
            return Reply.failed("ENGINE_DISABLED");
        }
        try {
            String body =
                    http.post()
                            .uri("/v1/argument/phrase")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(json.writeValueAsString(request))
                            .retrieve()
                            .body(String.class);
            return new Reply(json.readTree(body), null);
        } catch (HttpClientErrorException e) {
            return Reply.failed(
                    e.getStatusCode().value() == 422 ? "INPUT_INVALID" : "ENGINE_ERROR");
        } catch (ResourceAccessException e) {
            return Reply.failed(timedOut(e) ? "ENGINE_TIMEOUT" : "ENGINE_ERROR");
        } catch (RestClientException | JacksonException e) {
            return Reply.failed("ENGINE_ERROR");
        }
    }

    private static boolean timedOut(Throwable error) {
        for (Throwable e = error; e != null; e = e.getCause()) {
            if (e instanceof HttpTimeoutException || e instanceof SocketTimeoutException) {
                return true;
            }
        }
        return false;
    }

    public record Reply(JsonNode result, String failure) {
        static Reply failed(String reason) {
            return new Reply(null, reason);
        }
    }
}
