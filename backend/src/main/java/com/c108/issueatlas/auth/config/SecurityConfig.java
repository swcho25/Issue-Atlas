package com.c108.issueatlas.auth.config;

import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * 로그인·역할 2개(FR-I6). 서버 세션 쿠키 + CSRF(SPA 방식).
 *
 * <p>관리자 판정은 이 체인의 {@code /v1/admin/**} 규칙 한 곳에서만 한다. 판정 위치가 둘이면 서로 어긋나는 틈이 우회 경로가 된다. 막힌 요청은 MVC
 * 예외 처리기로 넘겨 다른 오류와 같은 problem+json(401 UNAUTHORIZED, 403 FORBIDDEN)으로 응답한다.
 *
 * <p>common 이 아니라 auth 에 둔 이유: common 이 user(계정 조회)에 의존하면 user → common 과 순환이 생긴다.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http,
            SecurityContextRepository securityContextRepository,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver exceptionResolver)
            throws Exception {
        return http.csrf(csrf -> csrf.spa())
                .securityContext(
                        context -> context.securityContextRepository(securityContextRepository))
                .authorizeHttpRequests(
                        auth ->
                                auth.dispatcherTypeMatchers(DispatcherType.ERROR)
                                        .permitAll()
                                        .requestMatchers(HttpMethod.GET, "/v1/auth/csrf")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.POST, "/v1/auth/login")
                                        .permitAll()
                                        // 일반 사용자 화면(C2 조회 · 질문)은 로그인 없이. 로그인은 관리자만
                                        .requestMatchers(
                                                HttpMethod.GET,
                                                "/v1/places",
                                                "/v1/places/*/cards",
                                                "/v1/places/*/boundaries",
                                                "/v1/arguments/*",
                                                "/v1/evidence/*",
                                                "/v1/observations",
                                                "/v1/sources")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.POST, "/v1/questions")
                                        .permitAll()
                                        .requestMatchers("/v1/admin/**")
                                        .hasRole("ADMIN")
                                        .requestMatchers("/v1/**")
                                        .authenticated()
                                        // ponytail: 배포 전 Swagger 공개 범위 재검토 (계획 파일 「다음 할 일」)
                                        .requestMatchers(
                                                "/swagger-ui.html",
                                                "/swagger-ui/**",
                                                "/v3/api-docs/**",
                                                "/actuator/health")
                                        .permitAll()
                                        .anyRequest()
                                        .denyAll())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(
                        logout ->
                                logout.logoutUrl("/v1/auth/logout")
                                        .logoutSuccessHandler(
                                                new HttpStatusReturningLogoutSuccessHandler(
                                                        HttpStatus.NO_CONTENT)))
                .exceptionHandling(
                        errors ->
                                errors.authenticationEntryPoint(
                                                (request, response, ex) ->
                                                        exceptionResolver.resolveException(
                                                                request, response, null, ex))
                                        .accessDeniedHandler(
                                                (request, response, ex) ->
                                                        exceptionResolver.resolveException(
                                                                request, response, null, ex)))
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    SessionAuthenticationStrategy sessionAuthenticationStrategy() {
        return new ChangeSessionIdAuthenticationStrategy();
    }
}
