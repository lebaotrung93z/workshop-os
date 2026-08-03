package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "ai_summaries")
@Getter
@Setter
public class AiSummary {
    @Id
    private UUID id;
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    @Column(nullable = false)
    private String provider;
    private String model;
    @Column(name = "insights_json", nullable = false, columnDefinition = "text")
    private String insightsJson;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
