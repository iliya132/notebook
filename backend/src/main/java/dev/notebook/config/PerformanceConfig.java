package dev.notebook.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Locale;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Adds inexpensive request phase timing that is visible in browser developer tools. */
@Configuration
public class PerformanceConfig implements WebMvcConfigurer {
  static final String STARTED_ATTRIBUTE = PerformanceConfig.class.getName() + ".started";

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(new ApiTimingInterceptor()).addPathPatterns("/api/**");
  }

  static final class ApiTimingInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(
        HttpServletRequest request, HttpServletResponse response, Object handler) {
      request.setAttribute(STARTED_ATTRIBUTE, System.nanoTime());
      return true;
    }
  }

  static String serverTiming(long startedNanos) {
    double durationMillis = (System.nanoTime() - startedNanos) / 1_000_000.0;
    return String.format(
        Locale.ROOT, "app;dur=%.1f;desc=\"Spring MVC and database\"", durationMillis);
  }
}
