package dev.notebook.config;

import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/** Writes the measured application time before the HTTP response is committed. */
@RestControllerAdvice
public class ServerTimingAdvice implements ResponseBodyAdvice<Object> {
  @Override
  public boolean supports(
      MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
    return true;
  }

  @Override
  public Object beforeBodyWrite(
      Object body,
      MethodParameter returnType,
      MediaType selectedContentType,
      Class<? extends HttpMessageConverter<?>> selectedConverterType,
      ServerHttpRequest request,
      ServerHttpResponse response) {
    if (!(request instanceof ServletServerHttpRequest servletRequest)) return body;
    Object started =
        servletRequest.getServletRequest().getAttribute(PerformanceConfig.STARTED_ATTRIBUTE);
    if (started instanceof Long startedNanos) {
      response.getHeaders().add("Server-Timing", PerformanceConfig.serverTiming(startedNanos));
    }
    return body;
  }
}
