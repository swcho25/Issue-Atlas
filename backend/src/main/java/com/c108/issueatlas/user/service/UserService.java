package com.c108.issueatlas.user.service;

import com.c108.issueatlas.common.exception.ResourceNotFoundException;
import com.c108.issueatlas.user.dto.AdminUserPage;
import com.c108.issueatlas.user.dto.UserResponse;
import com.c108.issueatlas.user.entity.AppUser;
import com.c108.issueatlas.user.entity.Role;
import com.c108.issueatlas.user.repository.AppUserRepository;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class UserService {
    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserService(AppUserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    public Optional<AppUser> findByEmail(String email) {
        return users.findByEmail(normalize(email));
    }

    public AppUser getByEmail(String email) {
        return findByEmail(email).orElseThrow(ResourceNotFoundException::new);
    }

    public AdminUserPage activeAdministrators(int page, int size) {
        if (page < 1 || size < 1 || size > 100)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var result =
                users.findByRoleAndActiveTrue(
                        Role.ADMIN, PageRequest.of(page - 1, size, Sort.by("id")));
        return new AdminUserPage(
                result.stream().map(UserResponse::from).toList(),
                page,
                size,
                result.getTotalElements());
    }

    /** {@code actorEmail} 은 계정을 만든 관리자. 첫 관리자처럼 만든 사람이 없으면 null. */
    @Transactional
    public AppUser create(
            String email, String rawPassword, String name, Role role, String actorEmail) {
        String normalized = normalize(email);
        if (users.existsByEmail(normalized)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }
        Long createdBy = actorEmail == null ? null : getByEmail(actorEmail).getId();
        return users.save(
                AppUser.create(
                        normalized,
                        passwordEncoder.encode(rawPassword),
                        name.strip(),
                        role,
                        createdBy,
                        Instant.now()));
    }

    @Transactional
    public AppUser changeActive(long id, boolean active, String actorEmail) {
        AppUser user = users.findById(id).orElseThrow(ResourceNotFoundException::new);
        if (!active && user.getId().equals(getByEmail(actorEmail).getId())) {
            // 마지막 관리자가 스스로를 꺼서 아무도 로그인할 수 없게 되는 일을 막는다
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        user.changeActive(active, Instant.now());
        return user;
    }

    @Transactional
    public void recordLogin(String email) {
        getByEmail(email).recordLogin(Instant.now());
    }

    private static String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
