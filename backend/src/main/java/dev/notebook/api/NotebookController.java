package dev.notebook.api;

import static dev.notebook.api.ApiDtos.*;

import dev.notebook.service.CurrentUser;
import dev.notebook.service.NoteService;
import dev.notebook.service.NotebookService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notebooks")
public class NotebookController {
  private final NotebookService service;
  private final CurrentUser current;
  private final NoteService notes;

  public NotebookController(NotebookService service, CurrentUser current, NoteService notes) {
    this.service = service;
    this.current = current;
    this.notes = notes;
  }

  @GetMapping
  public List<NotebookResponse> list(Authentication auth) {
    return service.list(current.id(auth));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public NotebookResponse create(Authentication auth, @Valid @RequestBody TitleRequest request) {
    return service.create(current.id(auth), request.title());
  }

  @GetMapping("/{id}")
  public NotebookDetail detail(Authentication auth, @PathVariable UUID id) {
    return service.detail(current.id(auth), id);
  }

  @PatchMapping("/{id}")
  public NotebookResponse rename(
      Authentication auth,
      @PathVariable UUID id,
      @Valid @RequestBody VersionedTitleRequest request) {
    return service.rename(current.id(auth), id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(Authentication auth, @PathVariable UUID id) {
    service.delete(current.id(auth), id);
  }

  @PostMapping("/{id}/notes")
  @ResponseStatus(HttpStatus.CREATED)
  public NoteResponse createNote(
      Authentication auth, @PathVariable UUID id, @Valid @RequestBody NoteRequest request) {
    return notes.create(current.id(auth), id, request);
  }
}
