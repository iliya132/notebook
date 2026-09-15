package dev.notebook.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
public class Notebook {
  @Id private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "owner_id")
  private AppUser owner;

  @Column(nullable = false, length = 200)
  private String title;

  @Version private long version;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected Notebook() {}

  public Notebook(AppUser owner, String title) {
    this.id = UUID.randomUUID();
    this.owner = owner;
    this.title = title;
    this.createdAt = this.updatedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public String getTitle() {
    return title;
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

  public void rename(String title) {
    this.title = title;
    this.updatedAt = Instant.now();
  }
}
