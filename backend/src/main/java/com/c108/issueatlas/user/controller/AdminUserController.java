package com.c108.issueatlas.user.controller;

import com.c108.issueatlas.user.dto.CreateUserRequest;
import com.c108.issueatlas.user.dto.UpdateUserRequest;
import com.c108.issueatlas.user.dto.UserResponse;
import com.c108.issueatlas.user.service.UserService;
import jakarta.validation.Valid;
import java.security.Principal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 전용. 권한은 경로({@code /v1/admin/**})로 보안 필터 체인 한 곳에서만 판정한다. */
@RestController
@RequestMapping("/v1/admin/users")
public class AdminUserController {
    private final UserService users;

    public AdminUserController(UserService users) {
        this.users = users;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@Valid @RequestBody CreateUserRequest request, Principal actor) {
        return UserResponse.from(
                users.create(
                        request.email(),
                        request.password(),
                        request.name(),
                        request.role(),
                        actor.getName()));
    }

    @PatchMapping("/{id}")
    public UserResponse update(
            @PathVariable long id, @Valid @RequestBody UpdateUserRequest request, Principal actor) {
        return UserResponse.from(users.changeActive(id, request.isActive(), actor.getName()));
    }
}
