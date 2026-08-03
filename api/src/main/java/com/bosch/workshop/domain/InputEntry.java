package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "input_entries")
@Getter
@Setter
public class InputEntry {
    @Id
    private UUID id;
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    @Column(name = "session_step_id", nullable = false)
    private UUID sessionStepId;
    @Column(name = "group_id")
    private UUID groupId;
    @Column(nullable = false)
    private String content;
    @Column(name = "author_id")
    private UUID authorId;
    @Column(nullable = false)
    private boolean hidden = false;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
