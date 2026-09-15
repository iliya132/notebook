package dev.notebook.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "note_share")
public class NoteShare {
  @Id private UUID id;

  @OneToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "note_id", unique = true)
  private Note note;

  @Column(name = "token_hash", nullable = false, unique = true, length = 64)
  private String tokenHash;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  protected NoteShare() {}

  public NoteShare(Note note, String tokenHash) {
    this.id = UUID.randomUUID();
    this.note = note;
    this.tokenHash = tokenHash;
    this.createdAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public Note getNote() {
    return note;
  }

  public String getTokenHash() {
    return tokenHash;
  }
}
