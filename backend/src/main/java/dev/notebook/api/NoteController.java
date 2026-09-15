package dev.notebook.api;

import static dev.notebook.api.ApiDtos.*;

import dev.notebook.service.CurrentUser;
import dev.notebook.service.NoteService;
import dev.notebook.service.ShareService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notes")
public class NoteController {
  private final NoteService notes;
  private final ShareService shares;
  private final CurrentUser current;

  public NoteController(NoteService notes, ShareService shares, CurrentUser current) {
    this.notes = notes;
    this.shares = shares;
    this.current = current;
  }

  @GetMapping("/{id}")
  public NoteResponse get(Authentication auth, @PathVariable UUID id) {
    return notes.get(current.id(auth), id);
  }

  @PutMapping("/{id}")
  public NoteResponse update(
      Authentication auth, @PathVariable UUID id, @Valid @RequestBody NoteUpdateRequest request) {
    return notes.update(current.id(auth), id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void delete(Authentication auth, @PathVariable UUID id) {
    notes.delete(current.id(auth), id);
  }

  @PostMapping("/{id}/share")
  @ResponseStatus(HttpStatus.CREATED)
  public ShareCreated share(Authentication auth, @PathVariable UUID id) {
    return shares.rotate(current.id(auth), id);
  }

  @GetMapping("/{id}/share")
  public ShareStatus shareStatus(Authentication auth, @PathVariable UUID id) {
    return shares.status(current.id(auth), id);
  }

  @DeleteMapping("/{id}/share")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void revoke(Authentication auth, @PathVariable UUID id) {
    shares.revoke(current.id(auth), id);
  }
}
