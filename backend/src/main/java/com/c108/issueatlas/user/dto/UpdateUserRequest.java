package com.c108.issueatlas.user.dto;

import jakarta.validation.constraints.NotNull;

/** JSON 이름은 snake_case 설정으로 {@code is_active}. */
public record UpdateUserRequest(@NotNull(message = "활성 여부는 필수입니다.") Boolean isActive) {}
