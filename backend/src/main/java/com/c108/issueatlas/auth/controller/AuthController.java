package com.c108.issueatlas.auth.controller;

import com.c108.issueatlas.auth.dto.LoginRequest;
import com.c108.issueatlas.auth.dto.MeResponse;
import com.c108.issueatlas.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 로그아웃({@code POST /v1/auth/logout})은 보안 필터 체인의 logout 설정이 처리한다. */
@Tag(name = "auth")
@RestController
@RequestMapping("/v1/auth")
public class AuthController {
    private final AuthService authService;
    private final SecurityContextRepository securityContextRepository;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;
    private final SecurityContextHolderStrategy contextHolder =
            SecurityContextHolder.getContextHolderStrategy();

    public AuthController(
            AuthService authService,
            SecurityContextRepository securityContextRepository,
            SessionAuthenticationStrategy sessionAuthenticationStrategy) {
        this.authService = authService;
        this.securityContextRepository = securityContextRepository;
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
    }

    /**
     * 로그인 전에 부른다. CSRF 토큰을 XSRF-TOKEN 쿠키로 내려 준다. 화면은 쿠키 값을 X-XSRF-TOKEN 헤더로 보낸다. 본문으로 토큰을 주지 않는 이유:
     * 응답용 토큰은 마스킹돼 헤더 검증과 값이 다르다.
     */
    @Operation(summary = "CSRF 토큰 쿠키(XSRF-TOKEN) 받기. 로그인 · POST 전에 부른다")
    @GetMapping("/csrf")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void csrf(@Parameter(hidden = true) CsrfToken token) {
        token.getToken();
    }

    @Operation(summary = "로그인 (이메일 · 비밀번호). 성공하면 세션 쿠키(JSESSIONID)와 내 정보")
    @PostMapping("/login")
    public MeResponse login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        Authentication authentication = authService.login(request.email(), request.password());
        // 이미 세션이 있으면 세션 ID 를 바꿔 세션 고정 공격을 막는다
        sessionAuthenticationStrategy.onAuthentication(authentication, httpRequest, httpResponse);
        SecurityContext context = contextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        contextHolder.setContext(context);
        // Spring Security 6 부터는 직접 저장해야 세션에 남는다. 빠뜨리면 다음 요청이 401 이다
        securityContextRepository.saveContext(context, httpRequest, httpResponse);
        return MeResponse.from(authService.me(authentication.getName()));
    }

    @Operation(summary = "내 정보 (로그인 필요, 없으면 401)")
    @GetMapping("/me")
    public MeResponse me(Principal principal) {
        return MeResponse.from(authService.me(principal.getName()));
    }
}
