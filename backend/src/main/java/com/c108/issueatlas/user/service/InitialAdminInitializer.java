package com.c108.issueatlas.user.service;

import com.c108.issueatlas.user.entity.Role;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * 서버 시작 시 첫 관리자를 만든다. 회원가입이 없으므로 다른 관리자는 이 계정이 만든다.
 *
 * <p>비밀번호를 SQL·코드에 남기지 않으려고 환경 변수(ADMIN_EMAIL·ADMIN_PASSWORD)로만 받는다. 같은 이메일이 이미 있으면 아무것도 하지 않아서 여러
 * 번 기동해도 한 명이다.
 */
@Component
class InitialAdminInitializer implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(InitialAdminInitializer.class);

    private final UserService users;
    private final String email;
    private final String password;

    InitialAdminInitializer(
            UserService users,
            @Value("${issue-atlas.admin.email:}") String email,
            @Value("${issue-atlas.admin.password:}") String password) {
        this.users = users;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.isBlank()) {
            log.warn("ADMIN_EMAIL·ADMIN_PASSWORD 가 없어 첫 관리자를 만들지 않았습니다.");
            return;
        }
        if (users.findByEmail(email).isPresent()) {
            return;
        }
        users.create(email, password, "관리자", Role.ADMIN, null);
        log.info("첫 관리자 계정을 만들었습니다.");
    }
}
