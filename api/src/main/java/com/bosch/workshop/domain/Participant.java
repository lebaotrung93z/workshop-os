package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "participants")
@Getter
@Setter
public class Participant {
    @Id
    private UUID id;
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    @Column(name = "display_name", nullable = false)
    private String displayName;
    @Column(name = "join_token_hash", nullable = false)
    private String joinTokenHash;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
