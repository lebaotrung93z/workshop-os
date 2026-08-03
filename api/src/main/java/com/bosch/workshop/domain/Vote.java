package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "votes")
@Getter
@Setter
public class Vote {
    @Id
    private UUID id;
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    @Column(name = "session_step_id", nullable = false)
    private UUID sessionStepId;
    @Column(name = "entry_id", nullable = false)
    private UUID entryId;
    @Column(name = "participant_id", nullable = false)
    private UUID participantId;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
