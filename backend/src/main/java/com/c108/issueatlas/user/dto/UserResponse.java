package com.c108.issueatlas.user.dto;

import com.c108.issueatlas.user.entity.AppUser;
import com.c108.issueatlas.user.entity.Role;

/** 비밀번호 해시는 응답에 넣지 않는다. */
public record UserResponse(Long id, String email, String name, Role role, boolean isActive) {
    public static UserResponse from(AppUser user) {
        return new UserResponse(
                user.getId(), user.getEmail(), user.getName(), user.getRole(), user.isActive());
    }
}
