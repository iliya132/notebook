package dev.notebook.api;

import static dev.notebook.api.ApiDtos.*;
import static org.springframework.security.web.context.HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY;

import dev.notebook.domain.AppUser;
import dev.notebook.security.RateLimitService;
import dev.notebook.security.UserPrincipal;
import dev.notebook.service.AuthService;
import dev.notebook.service.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
  private final AuthService auth;
  private final CurrentUser currentUser;
  private final RateLimitService limits;

  public AuthController(AuthService auth, CurrentUser currentUser, RateLimitService limits) {
    this.auth = auth;
    this.currentUser = currentUser;
    this.limits = limits;
  }

  @GetMapping("/csrf")
  public Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken());
  }

  @PostMapping("/register")
  @ResponseStatus(HttpStatus.CREATED)
  public UserResponse register(
      @Valid @RequestBody RegisterRequest request, HttpServletRequest servletRequest) {
    limits.check("register:" + client(servletRequest), 8, Duration.ofMinutes(10));
    AppUser user = auth.register(request);
    signIn(user, servletRequest);
    return auth.response(user);
  }

  @PostMapping("/login")
  public UserResponse login(
      @Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest) {
    limits.check("login:" + client(servletRequest), 12, Duration.ofMinutes(10));
    AppUser user = auth.authenticate(request.email(), request.password());
    signIn(user, servletRequest);
    return auth.response(user);
  }

  @GetMapping("/me")
  public UserResponse me(Authentication authentication) {
    return auth.get(currentUser.id(authentication));
  }

  private void signIn(AppUser user, HttpServletRequest request) {
    Authentication authentication =
        UsernamePasswordAuthenticationToken.authenticated(
            new UserPrincipal(user.getId(), user.getEmail()),
            null,
            java.util.List.of(new SimpleGrantedAuthority("ROLE_USER")));
    SecurityContext context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(authentication);
    SecurityContextHolder.setContext(context);
    request.getSession(true);
    request.changeSessionId();
    request.getSession(false).setAttribute(SPRING_SECURITY_CONTEXT_KEY, context);
  }

  private String client(HttpServletRequest request) {
    return request.getRemoteAddr();
  }
}
