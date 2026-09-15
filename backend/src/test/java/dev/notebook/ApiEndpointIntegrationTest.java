package dev.notebook;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.containers.PostgreSQLContainer;

/** Exercises every public REST endpoint against an isolated PostgreSQL instance. */
@SpringBootTest
@AutoConfigureMockMvc
class ApiEndpointIntegrationTest {
  private static final AtomicInteger CLIENT = new AtomicInteger(10);
  private static PostgreSQLContainer<?> postgres;

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    if (Boolean.parseBoolean(System.getenv("NOTEBOOK_LOCAL_TEST_DB"))) {
      configureDedicatedLocalDatabase(registry);
      return;
    }
    postgres = new PostgreSQLContainer<>("postgres:17-alpine");
    postgres.start();
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
  }

  @AfterAll
  static void stopContainer() {
    if (postgres != null) postgres.stop();
  }

  private static void configureDedicatedLocalDatabase(DynamicPropertyRegistry registry) {
    String adminUrl =
        System.getenv()
            .getOrDefault("NOTEBOOK_TEST_ADMIN_URL", "jdbc:postgresql://localhost:5432/postgres");
    String username = System.getenv().getOrDefault("NOTEBOOK_TEST_DB_USERNAME", "notebook");
    String password = System.getenv().getOrDefault("NOTEBOOK_TEST_DB_PASSWORD", "notebook");
    if (!adminUrl.matches("jdbc:postgresql://(localhost|127\\.0\\.0\\.1):[0-9]+/postgres")) {
      throw new IllegalStateException("Local test fallback only accepts a localhost postgres DB");
    }
    try (Connection connection = DriverManager.getConnection(adminUrl, username, password);
        Statement statement = connection.createStatement()) {
      statement.execute(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
              + "WHERE datname = 'notebook_test' AND pid <> pg_backend_pid()");
      statement.execute("DROP DATABASE IF EXISTS notebook_test");
      statement.execute("CREATE DATABASE notebook_test");
    } catch (SQLException exception) {
      throw new IllegalStateException(
          "Unable to recreate dedicated local test database", exception);
    }
    String testUrl = adminUrl.substring(0, adminUrl.lastIndexOf('/') + 1) + "notebook_test";
    registry.add("spring.datasource.url", () -> testUrl);
    registry.add("spring.datasource.username", () -> username);
    registry.add("spring.datasource.password", () -> password);
  }

  @Autowired MockMvc mvc;
  @Autowired ObjectMapper mapper;

  @Test
  void authEndpointsCoverCsrfRegistrationLoginMeAndLogout() throws Exception {
    mvc.perform(get("/api/v1/auth/csrf"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.token").isNotEmpty());
    mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized());

    Cookie registered = register("Alice", " Alice@Example.Test ");
    mvc.perform(get("/api/v1/auth/me").cookie(registered))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.name").value("Alice"))
        .andExpect(jsonPath("$.email").value("alice@example.test"));

    mvc.perform(
            post("/api/v1/auth/register")
                .with(csrf())
                .with(client())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    json(
                        Map.of(
                            "name",
                            "Again",
                            "email",
                            "ALICE@example.test",
                            "password",
                            "very-strong-password"))))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("registration_failed"));
    mvc.perform(
            post("/api/v1/auth/register")
                .with(csrf())
                .with(client())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\" \",\"email\":\"bad\",\"password\":\"short\"}"))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("validation_failed"));
    mvc.perform(
            post("/api/v1/auth/login")
                .with(csrf())
                .with(client())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"alice@example.test\",\"password\":\"wrong-password\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("invalid_credentials"));

    Cookie loggedIn = login("alice@example.test", "very-strong-password");
    mvc.perform(get("/api/v1/auth/me").cookie(loggedIn)).andExpect(status().isOk());
    mvc.perform(post("/api/v1/auth/logout").cookie(loggedIn).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/auth/me").cookie(loggedIn)).andExpect(status().isUnauthorized());
  }

  @Test
  void notebookEndpointsCoverListCreateReadRenameConflictAndDelete() throws Exception {
    Cookie owner = register("Notebook owner", email());
    mvc.perform(get("/api/v1/notebooks").cookie(owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isEmpty());
    mvc.perform(
            post("/api/v1/notebooks")
                .cookie(owner)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Blocked by CSRF\"}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("forbidden"));

    JsonNode notebook = createNotebook(owner, " Work ");
    String notebookId = notebook.path("id").asText();
    mvc.perform(get("/api/v1/notebooks").cookie(owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].title").value("Work"));
    mvc.perform(get("/api/v1/notebooks/{id}", notebookId).cookie(owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.notes").isEmpty());
    mvc.perform(
            patch("/api/v1/notebooks/{id}", notebookId)
                .cookie(owner)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Renamed\",\"version\":0}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Renamed"))
        .andExpect(jsonPath("$.version").value(1));
    mvc.perform(
            patch("/api/v1/notebooks/{id}", notebookId)
                .cookie(owner)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Stale\",\"version\":0}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("version_conflict"));
    mvc.perform(delete("/api/v1/notebooks/{id}", notebookId).cookie(owner).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/notebooks/{id}", notebookId).cookie(owner))
        .andExpect(status().isNotFound());
  }

  @Test
  void noteEndpointsCoverCreateReadUpdateAndDelete() throws Exception {
    Cookie owner = register("Note owner", email());
    String notebookId = createNotebook(owner, "Notes").path("id").asText();
    mvc.perform(
            post("/api/v1/notebooks/{id}/notes", notebookId)
                .cookie(owner)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\" \",\"content\":\"\"}"))
        .andExpect(status().isUnprocessableEntity());
    JsonNode note = createNote(owner, notebookId, "First", "# Draft");
    String noteId = note.path("id").asText();
    mvc.perform(get("/api/v1/notes/{id}", noteId).cookie(owner))
        .andExpect(status().isOk())
        .andExpect(
            header()
                .string(
                    "Server-Timing",
                    org.hamcrest.Matchers.matchesPattern(
                        "app;dur=[0-9.]+;desc=\"Spring MVC and database\"")))
        .andExpect(jsonPath("$.content").value("# Draft"));
    mvc.perform(
            put("/api/v1/notes/{id}", noteId)
                .cookie(owner)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Updated\",\"content\":\"new markdown\",\"version\":0}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Updated"))
        .andExpect(jsonPath("$.version").value(1));
    mvc.perform(
            put("/api/v1/notes/{id}", noteId)
                .cookie(owner)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Stale\",\"content\":\"lost\",\"version\":0}"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("version_conflict"));
    mvc.perform(delete("/api/v1/notes/{id}", noteId).cookie(owner).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/notes/{id}", noteId).cookie(owner)).andExpect(status().isNotFound());
  }

  @Test
  void noteSearchMatchesTitlesAndContentWithoutLeakingOtherUsersNotes() throws Exception {
    Cookie owner = register("Search owner", email());
    String notebookId = createNotebook(owner, "Работа").path("id").asText();
    createNote(owner, notebookId, "Квартальный план", "Цели команды");
    createNote(owner, notebookId, "Встреча", "Обсудить квартальный бюджет и сроки");

    Cookie intruder = register("Other owner", email());
    String otherNotebookId = createNotebook(intruder, "Личное").path("id").asText();
    createNote(intruder, otherNotebookId, "Квартальный секрет", "Не показывать");

    mvc.perform(get("/api/v1/notes/search").param("q", "КВАРТАЛЬ").cookie(owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(
            jsonPath("$[*].notebookTitle")
                .value(org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.is("Работа"))))
        .andExpect(
            jsonPath(
                "$[*].title",
                org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("Квартальный секрет"))))
        .andExpect(
            jsonPath("$[?(@.title == 'Встреча')].excerpt")
                .value(
                    org.hamcrest.Matchers.hasItem(
                        org.hamcrest.Matchers.containsString("квартальный бюджет"))));

    mvc.perform(get("/api/v1/notes/search").param("q", "   ").cookie(owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isEmpty());
    mvc.perform(get("/api/v1/notes/search").param("q", "x".repeat(101)).cookie(owner))
        .andExpect(status().isUnprocessableEntity())
        .andExpect(jsonPath("$.code").value("validation_failed"));
    mvc.perform(get("/api/v1/notes/search").param("q", "кварталь"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void sharingEndpointsCoverStatusRotationPublicReadAndRevocation() throws Exception {
    Cookie owner = register("Share owner", email());
    String notebookId = createNotebook(owner, "Shared").path("id").asText();
    String noteId = createNote(owner, notebookId, "Visible", "initial").path("id").asText();
    mvc.perform(get("/api/v1/notes/{id}/share", noteId).cookie(owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(false));

    String firstToken = share(owner, noteId);
    mvc.perform(get("/api/v1/notes/{id}/share", noteId).cookie(owner))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.enabled").value(true))
        .andExpect(jsonPath("$.url").doesNotExist());
    mvc.perform(get("/api/v1/public/notes/{token}", firstToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.title").value("Visible"));

    String secondToken = share(owner, noteId);
    assertThat(secondToken).isNotEqualTo(firstToken);
    mvc.perform(get("/api/v1/public/notes/{token}", firstToken)).andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/public/notes/{token}", secondToken)).andExpect(status().isOk());
    mvc.perform(delete("/api/v1/notes/{id}/share", noteId).cookie(owner).with(csrf()))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/public/notes/{token}", secondToken)).andExpect(status().isNotFound());
  }

  @Test
  void everyPrivateObjectEndpointRejectsAnotherUser() throws Exception {
    Cookie owner = register("Owner", email());
    String notebookId = createNotebook(owner, "Private").path("id").asText();
    String noteId = createNote(owner, notebookId, "Secret", "private").path("id").asText();
    Cookie intruder = register("Intruder", email());

    mvc.perform(get("/api/v1/notebooks/{id}", notebookId).cookie(intruder))
        .andExpect(status().isNotFound());
    mvc.perform(
            patch("/api/v1/notebooks/{id}", notebookId)
                .cookie(intruder)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Stolen\",\"version\":0}"))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/api/v1/notebooks/{id}", notebookId).cookie(intruder).with(csrf()))
        .andExpect(status().isNotFound());
    mvc.perform(
            post("/api/v1/notebooks/{id}/notes", notebookId)
                .cookie(intruder)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Injected\",\"content\":\"\"}"))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/notes/{id}", noteId).cookie(intruder))
        .andExpect(status().isNotFound());
    mvc.perform(
            put("/api/v1/notes/{id}", noteId)
                .cookie(intruder)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Stolen\",\"content\":\"\",\"version\":0}"))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/api/v1/notes/{id}", noteId).cookie(intruder).with(csrf()))
        .andExpect(status().isNotFound());
    mvc.perform(post("/api/v1/notes/{id}/share", noteId).cookie(intruder).with(csrf()))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/notes/{id}/share", noteId).cookie(intruder))
        .andExpect(status().isNotFound());
    mvc.perform(delete("/api/v1/notes/{id}/share", noteId).cookie(intruder).with(csrf()))
        .andExpect(status().isNotFound());
  }

  private Cookie register(String name, String email) throws Exception {
    MvcResult result =
        mvc.perform(
                post("/api/v1/auth/register")
                    .with(csrf())
                    .with(client())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        json(
                            Map.of(
                                "name", name, "email", email, "password", "very-strong-password"))))
            .andExpect(status().isCreated())
            .andReturn();
    return result.getResponse().getCookie("SESSION");
  }

  private Cookie login(String email, String password) throws Exception {
    MvcResult result =
        mvc.perform(
                post("/api/v1/auth/login")
                    .with(csrf())
                    .with(client())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("email", email, "password", password))))
            .andExpect(status().isOk())
            .andReturn();
    return result.getResponse().getCookie("SESSION");
  }

  private JsonNode createNotebook(Cookie session, String title) throws Exception {
    return body(
        mvc.perform(
                post("/api/v1/notebooks")
                    .cookie(session)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("title", title))))
            .andExpect(status().isCreated()));
  }

  private JsonNode createNote(Cookie session, String notebookId, String title, String content)
      throws Exception {
    return body(
        mvc.perform(
                post("/api/v1/notebooks/{id}/notes", notebookId)
                    .cookie(session)
                    .with(csrf())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json(Map.of("title", title, "content", content))))
            .andExpect(status().isCreated()));
  }

  private String share(Cookie session, String noteId) throws Exception {
    JsonNode response =
        body(
            mvc.perform(post("/api/v1/notes/{id}/share", noteId).cookie(session).with(csrf()))
                .andExpect(status().isCreated()));
    String url = response.path("url").asText();
    return url.substring(url.lastIndexOf('/') + 1);
  }

  private JsonNode body(org.springframework.test.web.servlet.ResultActions actions)
      throws Exception {
    return mapper.readTree(actions.andReturn().getResponse().getContentAsString());
  }

  private String json(Object body) throws Exception {
    return mapper.writeValueAsString(body);
  }

  private String email() {
    return UUID.randomUUID().toString() + "@example.test";
  }

  private RequestPostProcessor client() {
    return request -> {
      request.setRemoteAddr("10.0.0." + CLIENT.getAndIncrement());
      return request;
    };
  }
}
