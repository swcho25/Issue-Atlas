package com.c108.issueatlas.user.dto;

import com.c108.issueatlas.user.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 비밀번호 최대 72자는 BCrypt 가 실제로 쓰는 길이 한계다. */
public record CreateUserRequest(
        @NotBlank(message = "이메일은 필수입니다.") @Email(message = "이메일 형식이 아닙니다.") String email,
        @NotBlank(message = "비밀번호는 필수입니다.") @Size(min = 8, max = 72, message = "비밀번호는 8~72자입니다.")
                String password,
        @NotBlank(message = "이름은 필수입니다.") @Size(max = 50, message = "이름은 50자 이하입니다.") String name,
        @NotNull(message = "역할은 필수입니다.") Role role) {}
