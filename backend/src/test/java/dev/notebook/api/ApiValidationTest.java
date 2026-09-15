package dev.notebook.api;

import static org.assertj.core.api.Assertions.assertThat;

import dev.notebook.api.ApiDtos.NoteRequest;
import dev.notebook.api.ApiDtos.RegisterRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class ApiValidationTest {
  private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

  @Test
  void rejectsWhitespaceTitlesAndInvalidRegistration() {
    assertThat(validator.validate(new NoteRequest("   ", ""))).isNotEmpty();
    assertThat(validator.validate(new RegisterRequest("", "not-an-email", "short")))
        .hasSizeGreaterThanOrEqualTo(3);
  }

  @Test
  void acceptsEmptyNoteContent() {
    assertThat(validator.validate(new NoteRequest("Заголовок", ""))).isEmpty();
  }
}
