package dev.notebook.api;

import dev.notebook.api.ApiDtos.PublicNote;
import dev.notebook.security.RateLimitService;
import dev.notebook.service.ShareService;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/public/notes")
public class PublicController {
  private final ShareService shares;
  private final RateLimitService limits;

  public PublicController(ShareService shares, RateLimitService limits) {
    this.shares = shares;
    this.limits = limits;
  }

  @GetMapping("/{token}")
  public PublicNote get(@PathVariable String token, HttpServletRequest request) {
    limits.check("public:" + request.getRemoteAddr(), 120, Duration.ofMinutes(1));
    return shares.resolve(token);
  }
}
