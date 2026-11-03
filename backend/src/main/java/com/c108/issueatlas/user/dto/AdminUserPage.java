package com.c108.issueatlas.user.dto;

import java.util.List;

/** 승인자 선택용 활성 ADMIN 목록. 비밀번호와 해시는 포함하지 않는다. */
public record AdminUserPage(List<UserResponse> items, int page, int size, long total) {}
