package dev.notebook.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ApiDtos {
  private ApiDtos() {}

  public record RegisterRequest(
      @NotBlank @Size(max = 100) String name,
      @NotBlank @Email @Size(max = 320) String email,
      @NotBlank @Size(min = 10, max = 128) String password) {
    public RegisterRequest {
      if (email != null) email = email.trim();
    }
  }

  public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    public LoginRequest {
      if (email != null) email = email.trim();
    }
  }

  public record UserResponse(UUID id, String name, String email, Instant createdAt) {}

  public record TitleRequest(@NotBlank @Size(max = 200) String title) {}

  public record VersionedTitleRequest(
      @NotBlank @Size(max = 200) String title, @NotNull Long version) {}

  public record NoteRequest(
      @NotBlank @Size(max = 200) String title, @Size(max = 1_048_576) String content) {}

  public record NoteUpdateRequest(
      @NotBlank @Size(max = 200) String title,
      @Size(max = 1_048_576) String content,
      @NotNull Long version) {}

  public record NotebookResponse(
      UUID id, String title, long version, Instant createdAt, Instant updatedAt) {}

  public record NoteSummary(UUID id, String title, long version, Instant updatedAt) {}

  public record NoteSearchResult(
      UUID id,
      UUID notebookId,
      String notebookTitle,
      String title,
      String excerpt,
      Instant updatedAt) {}

  public record NotebookDetail(
      UUID id,
      String title,
      long version,
      Instant createdAt,
      Instant updatedAt,
      List<NoteSummary> notes) {}

  public record NoteResponse(
      UUID id,
      UUID notebookId,
      String title,
      String content,
      long version,
      Instant createdAt,
      Instant updatedAt) {}

  public record ShareStatus(boolean enabled) {}

  public record ShareCreated(boolean enabled, String url) {}

  public record PublicNote(String title, String content, Instant updatedAt) {}

  public record ApiError(
      String code, String message, Map<String, String> fields, Instant timestamp, String traceId) {}
}
