package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "workspaces")
@Getter
@Setter
public class Workspace {
    @Id
    private UUID id;
    @Column(nullable = false)
    private String name;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
