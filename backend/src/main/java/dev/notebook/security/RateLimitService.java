package dev.notebook.security;

import dev.notebook.api.ApiException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class RateLimitService {
  private final Map<String, ArrayDeque<Instant>> attempts = new ConcurrentHashMap<>();

  public void check(String key, int limit, Duration window) {
    ArrayDeque<Instant> queue = attempts.computeIfAbsent(key, ignored -> new ArrayDeque<>());
    synchronized (queue) {
      Instant cutoff = Instant.now().minus(window);
      while (!queue.isEmpty() && queue.peekFirst().isBefore(cutoff)) queue.removeFirst();
      if (queue.size() >= limit)
        throw new ApiException(
            HttpStatus.TOO_MANY_REQUESTS, "rate_limited", "Слишком много попыток. Повторите позже");
      queue.addLast(Instant.now());
    }
  }
}
