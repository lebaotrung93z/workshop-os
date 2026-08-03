package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "sessions")
@Getter
@Setter
public class WorkshopSession {
    @Id
    private UUID id;
    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;
    @Column(name = "template_id", nullable = false)
    private UUID templateId;
    @Column(nullable = false, length = 6, unique = true)
    private String code;
    @Column(nullable = false)
    private String title;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SessionStatus status;
    @Column(name = "current_step_id")
    private UUID currentStepId;
    @Column(name = "host_token_hash", nullable = false)
    private String hostTokenHash;
    @Column(name = "timer_ends_at")
    private Instant timerEndsAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
