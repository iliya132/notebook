package dev.notebook.repository;

import dev.notebook.domain.NoteShare;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoteShareRepository extends JpaRepository<NoteShare, UUID> {
  Optional<NoteShare> findByNoteId(UUID noteId);

  Optional<NoteShare> findByTokenHash(String tokenHash);

  void deleteByNoteId(UUID noteId);
}
