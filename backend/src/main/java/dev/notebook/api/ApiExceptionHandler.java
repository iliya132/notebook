package dev.notebook.api;

import static dev.notebook.api.ApiDtos.ApiError;

import jakarta.persistence.OptimisticLockException;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(ApiException.class)
  ResponseEntity<ApiError> api(ApiException exception, HttpServletRequest request) {
    return response(
        exception.getStatus(), exception.getCode(), exception.getMessage(), Map.of(), request);
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<ApiError> validation(
      MethodArgumentNotValidException exception, HttpServletRequest request) {
    Map<String, String> fields = new LinkedHashMap<>();
    exception
        .getBindingResult()
        .getFieldErrors()
        .forEach(error -> fields.putIfAbsent(error.getField(), error.getDefaultMessage()));
    return response(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "validation_failed",
        "Проверьте введённые данные",
        fields,
        request);
  }

  @ExceptionHandler({ObjectOptimisticLockingFailureException.class, OptimisticLockException.class})
  ResponseEntity<ApiError> conflict(Exception exception, HttpServletRequest request) {
    return response(
        HttpStatus.CONFLICT,
        "version_conflict",
        "Данные уже изменены в другой вкладке",
        Map.of(),
        request);
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<ApiError> integrity(
      DataIntegrityViolationException exception, HttpServletRequest request) {
    return response(
        HttpStatus.CONFLICT,
        "conflict",
        "Операция конфликтует с текущими данными",
        Map.of(),
        request);
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ApiError> unexpected(Exception exception, HttpServletRequest request) {
    return response(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "internal_error",
        "Внутренняя ошибка сервера",
        Map.of(),
        request);
  }

  private ResponseEntity<ApiError> response(
      HttpStatus status,
      String code,
      String message,
      Map<String, String> fields,
      HttpServletRequest request) {
    String traceId = request.getHeader("X-Request-ID");
    if (traceId == null || traceId.isBlank()) traceId = UUID.randomUUID().toString();
    return ResponseEntity.status(status)
        .body(new ApiError(code, message, fields, Instant.now(), traceId));
  }
}
