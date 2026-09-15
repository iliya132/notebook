package dev.notebook.service;

import static dev.notebook.api.ApiDtos.*;

import dev.notebook.api.ApiException;
import dev.notebook.domain.AppUser;
import dev.notebook.domain.Note;
import dev.notebook.domain.Notebook;
import dev.notebook.repository.NoteRepository;
import dev.notebook.repository.NotebookRepository;
import dev.notebook.repository.UserRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotebookService {
  private final NotebookRepository notebooks;
  private final NoteRepository notes;
  private final UserRepository users;

  public NotebookService(NotebookRepository notebooks, NoteRepository notes, UserRepository users) {
    this.notebooks = notebooks;
    this.notes = notes;
    this.users = users;
  }

  @Transactional(readOnly = true)
  public List<NotebookResponse> list(UUID ownerId) {
    return notebooks.findAllByOwnerIdOrderByUpdatedAtDesc(ownerId).stream()
        .map(this::response)
        .toList();
  }

  @Transactional
  public NotebookResponse create(UUID ownerId, String rawTitle) {
    AppUser owner = users.getReferenceById(ownerId);
    return response(notebooks.save(new Notebook(owner, title(rawTitle))));
  }

  @Transactional(readOnly = true)
  public NotebookDetail detail(UUID ownerId, UUID notebookId) {
    Notebook notebook = owned(ownerId, notebookId);
    List<NoteSummary> summaries =
        notes.findAllByNotebook_IdOrderByUpdatedAtDesc(notebookId).stream()
            .map(this::summary)
            .toList();
    return new NotebookDetail(
        notebook.getId(),
        notebook.getTitle(),
        notebook.getVersion(),
        notebook.getCreatedAt(),
        notebook.getUpdatedAt(),
        summaries);
  }

  @Transactional
  public NotebookResponse rename(UUID ownerId, UUID notebookId, VersionedTitleRequest request) {
    Notebook notebook = owned(ownerId, notebookId);
    if (notebook.getVersion() != request.version()) throw versionConflict();
    notebook.rename(title(request.title()));
    notebooks.flush();
    return response(notebook);
  }

  @Transactional
  public void delete(UUID ownerId, UUID notebookId) {
    notebooks.delete(owned(ownerId, notebookId));
  }

  Notebook owned(UUID ownerId, UUID notebookId) {
    return notebooks.findByIdAndOwnerId(notebookId, ownerId).orElseThrow(this::notFound);
  }

  private String title(String value) {
    String result = value.trim();
    if (result.isEmpty())
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY, "validation_failed", "Название не может быть пустым");
    return result;
  }

  private NotebookResponse response(Notebook value) {
    return new NotebookResponse(
        value.getId(),
        value.getTitle(),
        value.getVersion(),
        value.getCreatedAt(),
        value.getUpdatedAt());
  }

  private NoteSummary summary(Note value) {
    return new NoteSummary(
        value.getId(), value.getTitle(), value.getVersion(), value.getUpdatedAt());
  }

  private ApiException notFound() {
    return new ApiException(HttpStatus.NOT_FOUND, "not_found", "Записная книжка не найдена");
  }

  private ApiException versionConflict() {
    return new ApiException(
        HttpStatus.CONFLICT, "version_conflict", "Данные уже изменены в другой вкладке");
  }
}
