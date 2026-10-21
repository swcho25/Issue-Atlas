package com.c108.issueatlas.common.exception;

import java.net.URI;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex,
            Object body,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        ApiErrorCode code = ApiErrorCode.forStatus(status.value());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, code.detail());
        problem.setType(
                URI.create(
                        "urn:issue-atlas:error:"
                                + code.name().toLowerCase(Locale.ROOT).replace('_', '-')));
        problem.setProperty("code", code.name());
        List<FieldViolation> errors = List.of();
        if (ex instanceof MethodArgumentNotValidException validation) {
            errors =
                    validation.getBindingResult().getAllErrors().stream()
                            .map(
                                    error ->
                                            new FieldViolation(
                                                    error instanceof FieldError fieldError
                                                            ? fieldError.getField()
                                                            : "$",
                                                    error.getDefaultMessage() == null
                                                            ? "올바른 값을 입력해 주세요."
                                                            : error.getDefaultMessage()))
                            .sorted(
                                    Comparator.comparing(FieldViolation::field)
                                            .thenComparing(FieldViolation::message))
                            .toList();
        }
        problem.setProperty("errors", errors);
        return super.handleExceptionInternal(ex, problem, headers, status, request);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Object> handleNotFound(ResourceNotFoundException ex, WebRequest request) {
        return handleExceptionInternal(ex, null, new HttpHeaders(), HttpStatus.NOT_FOUND, request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Object> handleUnexpected(Exception ex, WebRequest request) {
        logger.error("Unexpected API exception", ex);
        return handleExceptionInternal(
                ex, null, new HttpHeaders(), HttpStatus.INTERNAL_SERVER_ERROR, request);
    }
}
