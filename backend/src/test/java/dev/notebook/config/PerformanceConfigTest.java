package dev.notebook.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class PerformanceConfigTest {
  @Test
  void addsServerTimingHeaderWithoutExposingRequestData() {
    PerformanceConfig.ApiTimingInterceptor interceptor =
        new PerformanceConfig.ApiTimingInterceptor();
    MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/notes/secret");

    interceptor.preHandle(request, null, new Object());
    long started = (Long) request.getAttribute(PerformanceConfig.STARTED_ATTRIBUTE);

    assertThat(PerformanceConfig.serverTiming(started))
        .matches("app;dur=[0-9.]+;desc=\\\"Spring MVC and database\\\"")
        .doesNotContain("secret");
  }
}
