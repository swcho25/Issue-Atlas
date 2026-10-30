package com.c108.issueatlas.auth.dto;

import com.c108.issueatlas.user.entity.AppUser;
import com.c108.issueatlas.user.entity.Role;

/** 화면이 관리자 메뉴를 보일지 정할 때 쓴다. 비밀번호 해시는 넣지 않는다. */
public record MeResponse(Long id, String email, String name, Role role) {
    public static MeResponse from(AppUser user) {
        return new MeResponse(user.getId(), user.getEmail(), user.getName(), user.getRole());
    }
}
