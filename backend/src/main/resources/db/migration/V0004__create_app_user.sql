-- 로그인 계정(FR-I6). 역할은 관리자·조회자 2개, 단일 조직. 회원가입 없이 관리자가 계정을 만든다.
-- 계정은 지우지 않고 is_active 로 끈다(검수 이력이 계정을 가리키기 때문).
-- 번호 V0004: core-schema(V0002~V0003) 다음. core-schema 를 먼저 머지한다.
CREATE TABLE app_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email         TEXT        NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash TEXT        NOT NULL,
    name          TEXT        NOT NULL,
    role          TEXT        NOT NULL CHECK (role IN ('ADMIN', 'VIEWER')),
    is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_by    BIGINT      REFERENCES app_user (id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);
