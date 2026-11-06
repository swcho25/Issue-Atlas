package com.c108.issueatlas.auth.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "issue-atlas.monitoring.enabled", havingValue = "true")
public class MonitoringSecurityConfig {
    @Bean
    @Order(0)
    SecurityFilterChain monitoringSecurity(
            HttpSecurity http, @Value("${issue-atlas.monitoring.port:9091}") int port)
            throws Exception {
        // 전달 헤더의 서버 주소가 아니라 실제로 연결된 포트로 판단한다.
        return http.securityMatcher(request -> request.getLocalPort() == port)
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(
                        session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(
                        auth ->
                                auth.requestMatchers(HttpMethod.GET, "/actuator/prometheus")
                                        .permitAll()
                                        .anyRequest()
                                        .denyAll())
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .build();
    }
}
