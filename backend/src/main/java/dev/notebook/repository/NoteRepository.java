package dev.notebook.repository;

import dev.notebook.domain.Note;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoteRepository extends JpaRepository<Note, UUID> {
  List<Note> findAllByNotebook_IdOrderByUpdatedAtDesc(UUID notebookId);

  Optional<Note> findByIdAndNotebook_Owner_Id(UUID id, UUID ownerId);
}
