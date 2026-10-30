package com.c108.issueatlas.auth.service;

import com.c108.issueatlas.user.service.UserService;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

/** 로그인 사용자 이름은 이메일. 비활성 계정은 disabled 라 로그인할 수 없다. */
@Service
public class AppUserDetailsService implements UserDetailsService {
    private final UserService users;

    public AppUserDetailsService(UserService users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email) {
        return users.findByEmail(email)
                .map(
                        user ->
                                User.withUsername(user.getEmail())
                                        .password(user.getPasswordHash())
                                        .roles(user.getRole().name())
                                        .disabled(!user.isActive())
                                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("not found"));
    }
}
