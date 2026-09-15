package dev.notebook.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.notebook.api.ApiDtos.ApiError;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {
  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder(12);
  }

  /**
   * Authentication is handled by AuthController and server sessions, not by HTTP Basic/form login.
   * Declaring this bean prevents Spring Boot from creating and logging a development user password.
   */
  @Bean
  UserDetailsService userDetailsService() {
    return username -> {
      throw new UsernameNotFoundException("Local password authentication is not configured");
    };
  }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http, ObjectMapper mapper) throws Exception {
    CookieCsrfTokenRepository csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
    csrf.setCookiePath("/");
    http.cors(Customizer.withDefaults())
        .csrf(config -> config.csrfTokenRepository(csrf))
        .sessionManagement(
            config -> config.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        HttpMethod.GET,
                        "/api/v1/auth/csrf",
                        "/api/v1/public/**",
                        "/actuator/health/**",
                        "/v3/api-docs/**",
                        "/swagger-ui/**",
                        "/swagger-ui.html")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/v1/auth/register", "/api/v1/auth/login")
                    .permitAll()
                    .requestMatchers("/api/v1/**")
                    .authenticated()
                    .anyRequest()
                    .permitAll())
        .exceptionHandling(
            errors ->
                errors
                    .authenticationEntryPoint(
                        (request, response, exception) -> {
                          response.setStatus(401);
                          response.setContentType("application/json");
                          mapper.writeValue(
                              response.getWriter(),
                              new ApiError(
                                  "unauthorized",
                                  "Требуется вход",
                                  Map.of(),
                                  Instant.now(),
                                  UUID.randomUUID().toString()));
                        })
                    .accessDeniedHandler(
                        (request, response, exception) -> {
                          response.setStatus(403);
                          response.setContentType("application/json");
                          mapper.writeValue(
                              response.getWriter(),
                              new ApiError(
                                  "forbidden",
                                  "Запрос отклонён",
                                  Map.of(),
                                  Instant.now(),
                                  UUID.randomUUID().toString()));
                        }))
        .logout(
            logout ->
                logout
                    .logoutUrl("/api/v1/auth/logout")
                    .invalidateHttpSession(true)
                    .deleteCookies("SESSION")
                    .logoutSuccessHandler(
                        (request, response, authentication) -> response.setStatus(204)));
    return http.build();
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(@Value("${app.frontend-origin}") String origin) {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(java.util.List.of(origin));
    config.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(java.util.List.of("Content-Type", "X-XSRF-TOKEN", "X-Request-ID"));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
  }
}
