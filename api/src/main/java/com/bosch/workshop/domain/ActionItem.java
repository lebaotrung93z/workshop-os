package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "action_items")
@Getter
@Setter
public class ActionItem {
    @Id
    private UUID id;
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    @Column(nullable = false)
    private String action;
    private String owner;
    @Column(name = "due_date")
    private LocalDate dueDate;
    @Column(name = "source_entry_id")
    private UUID sourceEntryId;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
