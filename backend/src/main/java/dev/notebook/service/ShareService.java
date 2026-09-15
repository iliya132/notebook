package dev.notebook.service;

import static dev.notebook.api.ApiDtos.*;

import dev.notebook.api.ApiException;
import dev.notebook.domain.Note;
import dev.notebook.domain.NoteShare;
import dev.notebook.repository.NoteShareRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShareService {
  private final NoteShareRepository shares;
  private final NoteService notes;
  private final SecureRandom random = new SecureRandom();
  private final String publicBaseUrl;

  public ShareService(
      NoteShareRepository shares,
      NoteService notes,
      @Value("${app.public-base-url}") String publicBaseUrl) {
    this.shares = shares;
    this.notes = notes;
    this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
  }

  @Transactional
  public ShareCreated rotate(UUID ownerId, UUID noteId) {
    Note note = notes.owned(ownerId, noteId);
    shares.findByNoteId(noteId).ifPresent(shares::delete);
    shares.flush();
    String token = generateToken(random);
    shares.save(new NoteShare(note, hash(token)));
    return new ShareCreated(true, publicBaseUrl + "/share/" + token);
  }

  @Transactional(readOnly = true)
  public ShareStatus status(UUID ownerId, UUID noteId) {
    notes.owned(ownerId, noteId);
    return new ShareStatus(shares.findByNoteId(noteId).isPresent());
  }

  @Transactional
  public void revoke(UUID ownerId, UUID noteId) {
    notes.owned(ownerId, noteId);
    shares.deleteByNoteId(noteId);
  }

  @Transactional(readOnly = true)
  public PublicNote resolve(String token) {
    if (token.length() < 40 || token.length() > 100) throw notFound();
    Note note = shares.findByTokenHash(hash(token)).orElseThrow(this::notFound).getNote();
    return new PublicNote(note.getTitle(), note.getContent(), note.getUpdatedAt());
  }

  public static String hash(String token) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 unavailable", exception);
    }
  }

  public static String generateToken(SecureRandom random) {
    byte[] bytes = new byte[32];
    random.nextBytes(bytes);
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private ApiException notFound() {
    return new ApiException(HttpStatus.NOT_FOUND, "not_found", "Публичная заметка не найдена");
  }
}
