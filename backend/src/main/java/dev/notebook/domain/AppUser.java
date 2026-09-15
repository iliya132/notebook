package dev.notebook.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "app_user")
public class AppUser {
  @Id private UUID id;

  @Column(nullable = false, length = 100)
  private String name;

  @Column(nullable = false, length = 320, unique = true)
  private String email;

  @Column(name = "password_hash", nullable = false, length = 100)
  private String passwordHash;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  protected AppUser() {}

  public AppUser(String name, String email, String passwordHash) {
    this.id = UUID.randomUUID();
    this.name = name;
    this.email = email;
    this.passwordHash = passwordHash;
    this.createdAt = this.updatedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getEmail() {
    return email;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
