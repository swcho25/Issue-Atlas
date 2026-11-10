package com.c108.issueatlas.question.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * 익명 질문(POST /v1/questions)을 IP 당 분당 N건으로 막는다. 넘으면 429 TOO_MANY_REQUESTS. 질문 1건 = 판정 실행(곧 LLM 문장화
 * 토큰)이라 문장화를 붙이기 전에 둔다(!133 리뷰).
 *
 * <p>IP 는 Cloudflare 가 붙이는 CF-Connecting-IP, 없으면 접속 주소. 백엔드는 Cloudflare Tunnel 뒤에만 열려 있어 이 헤더를 믿는다.
 */
// ponytail: 서버 한 대 메모리 · 고정 1분 창 · 전역 잠금. 서버가 늘면 공용 저장소(Redis 등)로
@Component
public class QuestionRateLimitFilter extends OncePerRequestFilter {
    private final int perMinute;
    private final HandlerExceptionResolver errors;
    private long minute = -1;
    private Map<String, Integer> counts = new HashMap<>();

    public QuestionRateLimitFilter(
            @Value("${issue-atlas.questions.per-minute}") int perMinute,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver errors) {
        this.perMinute = perMinute;
        this.errors = errors;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !("POST".equals(request.getMethod())
                && "/v1/questions".equals(request.getRequestURI()));
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String ip = request.getHeader("CF-Connecting-IP");
        if (ip == null || ip.isBlank()) ip = request.getRemoteAddr();
        if (allow(ip, System.currentTimeMillis() / 60_000)) {
            chain.doFilter(request, response);
            return;
        }
        response.setHeader(HttpHeaders.RETRY_AFTER, "60");
        errors.resolveException(
                request, response, null, new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS));
    }

    synchronized boolean allow(String ip, long nowMinute) {
        if (nowMinute != minute) {
            minute = nowMinute;
            counts = new HashMap<>();
        }
        return counts.merge(ip, 1, Integer::sum) <= perMinute;
    }
}
