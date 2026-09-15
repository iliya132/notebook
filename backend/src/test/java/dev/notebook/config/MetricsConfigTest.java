package dev.notebook.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.FunctionTimer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.concurrent.TimeUnit;
import org.hibernate.stat.QueryStatistics;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;

class MetricsConfigTest {
  @Test
  void publishesAggregateQueryTimingAndRegistersEachTemplateOnce() {
    Statistics statistics = mock(Statistics.class);
    QueryStatistics queryStatistics = mock(QueryStatistics.class);
    String query = "select note where owner_id=?";
    when(statistics.getQueries()).thenReturn(new String[] {query});
    when(statistics.getQueryStatistics(query)).thenReturn(queryStatistics);
    when(queryStatistics.getExecutionCount()).thenReturn(2L);
    when(queryStatistics.getExecutionTotalTime()).thenReturn(15L);
    when(queryStatistics.getExecutionMaxTime()).thenReturn(10L);
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    MetricsConfig.DatabaseQueryMetricsInterceptor interceptor =
        new MetricsConfig.DatabaseQueryMetricsInterceptor(statistics, registry);

    interceptor.afterCompletion(null, null, new Object(), null);
    interceptor.afterCompletion(null, null, new Object(), null);

    FunctionTimer timer =
        registry.find("notebook.database.query").tag("query", query).functionTimer();
    assertThat(timer).isNotNull();
    assertThat(timer.count()).isEqualTo(2);
    assertThat(timer.totalTime(TimeUnit.MILLISECONDS)).isEqualTo(15);
    assertThat(registry.find("notebook.database.query.max").tag("query", query).gauge())
        .isNotNull();
    verify(statistics).getQueryStatistics(query);
  }
}
