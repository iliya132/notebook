package dev.notebook.config;

import io.micrometer.core.instrument.FunctionTimer;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.TimeGauge;
import jakarta.persistence.EntityManagerFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.hibernate.SessionFactory;
import org.hibernate.stat.QueryStatistics;
import org.hibernate.stat.Statistics;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Publishes aggregate Hibernate SELECT timings without bind parameters or application data. */
@Configuration
public class MetricsConfig implements WebMvcConfigurer {
  private final DatabaseQueryMetricsInterceptor interceptor;

  MetricsConfig(EntityManagerFactory entityManagerFactory, MeterRegistry meterRegistry) {
    Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
    this.interceptor = new DatabaseQueryMetricsInterceptor(statistics, meterRegistry);
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(interceptor).addPathPatterns("/api/**");
  }

  static final class DatabaseQueryMetricsInterceptor implements HandlerInterceptor {
    private final Statistics statistics;
    private final MeterRegistry meterRegistry;
    private final Set<String> registeredQueries = ConcurrentHashMap.newKeySet();

    DatabaseQueryMetricsInterceptor(Statistics statistics, MeterRegistry meterRegistry) {
      this.statistics = statistics;
      this.meterRegistry = meterRegistry;
    }

    @Override
    public void afterCompletion(
        HttpServletRequest request,
        HttpServletResponse response,
        Object handler,
        Exception exception) {
      for (String query : statistics.getQueries()) {
        register(query);
      }
    }

    private void register(String query) {
      if (!registeredQueries.add(query)) return;
      QueryStatistics queryStatistics = statistics.getQueryStatistics(query);
      FunctionTimer.builder(
              "notebook.database.query",
              queryStatistics,
              QueryStatistics::getExecutionCount,
              QueryStatistics::getExecutionTotalTime,
              TimeUnit.MILLISECONDS)
          .description("Hibernate database SELECT execution time")
          .tag("query", query)
          .register(meterRegistry);
      TimeGauge.builder(
              "notebook.database.query.max",
              queryStatistics,
              TimeUnit.MILLISECONDS,
              QueryStatistics::getExecutionMaxTime)
          .description("Slowest Hibernate database SELECT execution")
          .tag("query", query)
          .register(meterRegistry);
    }
  }
}
