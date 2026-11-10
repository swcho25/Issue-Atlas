package com.c108.issueatlas.user.repository;

import com.c108.issueatlas.user.entity.AppUser;
import com.c108.issueatlas.user.entity.Role;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByEmail(String email);

    boolean existsByEmail(String email);

    Page<AppUser> findByRoleAndActiveTrue(Role role, Pageable pageable);
}
