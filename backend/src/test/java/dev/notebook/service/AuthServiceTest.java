package dev.notebook.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AuthServiceTest {
  @Test
  void normalizesEmail() {
    assertThat(AuthService.normalizeEmail("  User@Example.COM ")).isEqualTo("user@example.com");
  }
}
