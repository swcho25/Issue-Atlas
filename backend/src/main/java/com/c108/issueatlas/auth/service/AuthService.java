package com.c108.issueatlas.auth.service;

import com.c108.issueatlas.user.entity.AppUser;
import com.c108.issueatlas.user.service.UserService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final AuthenticationManager authenticationManager;
    private final UserService users;

    public AuthService(AuthenticationManager authenticationManager, UserService users) {
        this.authenticationManager = authenticationManager;
        this.users = users;
    }

    /** 실패하면 AuthenticationException → 401. 이유(없는 계정·비밀번호·비활성)는 구분해 알리지 않는다. */
    public Authentication login(String email, String password) {
        Authentication authentication =
                authenticationManager.authenticate(
                        UsernamePasswordAuthenticationToken.unauthenticated(email, password));
        users.recordLogin(authentication.getName());
        return authentication;
    }

    public AppUser me(String email) {
        return users.getByEmail(email);
    }
}
