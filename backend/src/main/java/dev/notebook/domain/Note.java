package dev.notebook.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
public class Note {
  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "notebook_id")
  private Notebook notebook;

  @Column(nullable = false, length = 200)
  private String title;

  @Column(nullable = false, columnDefinition = "text")
  private String content;

  @Version private long version;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected Note() {}

  public Note(Notebook notebook, String title, String content) {
    this.id = UUID.randomUUID();
    this.notebook = notebook;
    this.title = title;
    this.content = content;
    this.createdAt = this.updatedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public UUID getNotebookId() {
    return notebook.getId();
  }

  public String getNotebookTitle() {
    return notebook.getTitle();
  }

  public String getTitle() {
    return title;
  }

  public String getContent() {
    return content;
  }

  public long getVersion() {
    return version;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void update(String title, String content) {
    this.title = title;
    this.content = content;
    this.updatedAt = Instant.now();
  }
}
