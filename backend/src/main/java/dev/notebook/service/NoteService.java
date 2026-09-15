package dev.notebook.service;

import static dev.notebook.api.ApiDtos.*;

import dev.notebook.api.ApiException;
import dev.notebook.domain.Note;
import dev.notebook.domain.Notebook;
import dev.notebook.repository.NoteRepository;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NoteService {
  private final NoteRepository notes;
  private final NotebookService notebooks;

  public NoteService(NoteRepository notes, NotebookService notebooks) {
    this.notes = notes;
    this.notebooks = notebooks;
  }

  @Transactional
  public NoteResponse create(UUID ownerId, UUID notebookId, NoteRequest request) {
    Notebook notebook = notebooks.owned(ownerId, notebookId);
    return response(
        notes.save(new Note(notebook, title(request.title()), content(request.content()))));
  }

  @Transactional(readOnly = true)
  public NoteResponse get(UUID ownerId, UUID noteId) {
    return response(owned(ownerId, noteId));
  }

  @Transactional
  public NoteResponse update(UUID ownerId, UUID noteId, NoteUpdateRequest request) {
    Note note = owned(ownerId, noteId);
    if (note.getVersion() != request.version())
      throw new ApiException(
          HttpStatus.CONFLICT, "version_conflict", "Данные уже изменены в другой вкладке");
    note.update(title(request.title()), content(request.content()));
    notes.flush();
    return response(note);
  }

  @Transactional
  public UUID delete(UUID ownerId, UUID noteId) {
    Note note = owned(ownerId, noteId);
    UUID notebookId = note.getNotebookId();
    notes.delete(note);
    return notebookId;
  }

  Note owned(UUID ownerId, UUID noteId) {
    return notes
        .findByIdAndNotebook_Owner_Id(noteId, ownerId)
        .orElseThrow(
            () -> new ApiException(HttpStatus.NOT_FOUND, "not_found", "Заметка не найдена"));
  }

  NoteResponse response(Note note) {
    return new NoteResponse(
        note.getId(),
        note.getNotebookId(),
        note.getTitle(),
        note.getContent(),
        note.getVersion(),
        note.getCreatedAt(),
        note.getUpdatedAt());
  }

  private String title(String raw) {
    String value = raw.trim();
    if (value.isEmpty())
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY, "validation_failed", "Название не может быть пустым");
    return value;
  }

  private String content(String raw) {
    String value = raw == null ? "" : raw;
    if (value.getBytes(StandardCharsets.UTF_8).length > 1_048_576)
      throw new ApiException(
          HttpStatus.UNPROCESSABLE_ENTITY, "validation_failed", "Содержимое слишком большое");
    return value;
  }
}
