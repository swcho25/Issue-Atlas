package com.c108.issueatlas.common.exception;

public enum ApiErrorCode {
    INVALID_REQUEST("요청 형식이나 값을 확인해 주세요."),
    UNAUTHORIZED("로그인이 필요합니다."),
    FORBIDDEN("이 작업을 할 권한이 없습니다."),
    RESOURCE_NOT_FOUND("요청한 리소스를 찾을 수 없습니다."),
    INTERNAL_ERROR("서버에서 요청을 처리하지 못했습니다."),
    HTTP_ERROR("요청을 처리할 수 없습니다.");

    private final String detail;

    ApiErrorCode(String detail) {
        this.detail = detail;
    }

    public String detail() {
        return detail;
    }

    static ApiErrorCode forStatus(int status) {
        if (status >= 500) return INTERNAL_ERROR;
        return switch (status) {
            case 400 -> INVALID_REQUEST;
            case 401 -> UNAUTHORIZED;
            case 403 -> FORBIDDEN;
            case 404 -> RESOURCE_NOT_FOUND;
            default -> HTTP_ERROR;
        };
    }
}
