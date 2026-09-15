package dev.notebook.service;

import dev.notebook.api.ApiDtos.RegisterRequest;
import dev.notebook.api.ApiDtos.UserResponse;
import dev.notebook.api.ApiException;
import dev.notebook.domain.AppUser;
import dev.notebook.repository.UserRepository;
import java.util.Locale;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
  private final UserRepository users;
  private final PasswordEncoder passwords;

  public AuthService(UserRepository users, PasswordEncoder passwords) {
    this.users = users;
    this.passwords = passwords;
  }

  public static String normalizeEmail(String email) {
    return email.trim().toLowerCase(Locale.ROOT);
  }

  @Transactional
  public AppUser register(RegisterRequest request) {
    String email = normalizeEmail(request.email());
    if (users.existsByEmail(email)) throw registrationFailed();
    try {
      return users.saveAndFlush(
          new AppUser(request.name().trim(), email, passwords.encode(request.password())));
    } catch (DataIntegrityViolationException exception) {
      throw registrationFailed();
    }
  }

  @Transactional(readOnly = true)
  public AppUser authenticate(String email, String password) {
    AppUser user = users.findByEmail(normalizeEmail(email)).orElse(null);
    if (user == null || !passwords.matches(password, user.getPasswordHash())) {
      throw new ApiException(
          HttpStatus.UNAUTHORIZED, "invalid_credentials", "Неверный email или пароль");
    }
    return user;
  }

  @Transactional(readOnly = true)
  public UserResponse get(java.util.UUID id) {
    AppUser user =
        users
            .findById(id)
            .orElseThrow(
                () -> new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized", "Требуется вход"));
    return response(user);
  }

  public UserResponse response(AppUser user) {
    return new UserResponse(user.getId(), user.getName(), user.getEmail(), user.getCreatedAt());
  }

  private ApiException registrationFailed() {
    return new ApiException(
        HttpStatus.CONFLICT, "registration_failed", "Не удалось зарегистрировать аккаунт");
  }
}
