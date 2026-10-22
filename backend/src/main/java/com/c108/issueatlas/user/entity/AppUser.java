package com.c108.issueatlas.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** 로그인 계정. 지우지 않고 {@link #changeActive} 로 끈다. */
@Entity
@Table(name = "app_user")
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, updatable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_by", updatable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    protected AppUser() {}

    /** 이메일은 소문자로 정규화된 값, 비밀번호는 이미 해시된 값을 받는다. */
    public static AppUser create(
            String email,
            String passwordHash,
            String name,
            Role role,
            Long createdBy,
            Instant now) {
        AppUser user = new AppUser();
        user.email = email;
        user.passwordHash = passwordHash;
        user.name = name;
        user.role = role;
        user.active = true;
        user.createdBy = createdBy;
        user.createdAt = now;
        user.updatedAt = now;
        return user;
    }

    public void changeActive(boolean active, Instant now) {
        this.active = active;
        this.updatedAt = now;
    }

    public void recordLogin(Instant now) {
        this.lastLoginAt = now;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getName() {
        return name;
    }

    public Role getRole() {
        return role;
    }

    public boolean isActive() {
        return active;
    }
}
