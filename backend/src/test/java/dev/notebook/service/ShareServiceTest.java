package dev.notebook.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.security.SecureRandom;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class ShareServiceTest {
  @Test
  void hashesTokensDeterministicallyWithoutKeepingPlaintext() {
    String hash = ShareService.hash("secret-token");
    assertThat(hash)
        .hasSize(64)
        .isEqualTo(ShareService.hash("secret-token"))
        .doesNotContain("secret-token");
  }

  @Test
  void generatesAtLeast256BitsOfRandomTokenMaterial() {
    String first = ShareService.generateToken(new SecureRandom());
    String second = ShareService.generateToken(new SecureRandom());
    assertThat(Base64.getUrlDecoder().decode(first)).hasSize(32);
    assertThat(second).isNotEqualTo(first);
  }
}
