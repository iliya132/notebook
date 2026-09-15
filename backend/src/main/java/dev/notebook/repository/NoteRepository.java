package dev.notebook.repository;

import dev.notebook.domain.Note;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NoteRepository extends JpaRepository<Note, UUID> {
  List<Note> findAllByNotebook_IdOrderByUpdatedAtDesc(UUID notebookId);

  Optional<Note> findByIdAndNotebook_Owner_Id(UUID id, UUID ownerId);

  @Query(
      """
      select note from Note note join fetch note.notebook notebook
      where notebook.owner.id = :ownerId
        and (locate(lower(:query), lower(note.title)) > 0
          or locate(lower(:query), lower(note.content)) > 0)
      order by note.updatedAt desc
      """)
  List<Note> searchOwned(
      @Param("ownerId") UUID ownerId, @Param("query") String query, Pageable pageable);
}
