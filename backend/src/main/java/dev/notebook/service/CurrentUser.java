package dev.notebook.service;

import dev.notebook.security.UserPrincipal;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

@Component
public class CurrentUser {
  public UUID id(Authentication authentication) {
    return ((UserPrincipal) authentication.getPrincipal()).id();
  }
}
