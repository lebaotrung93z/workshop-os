package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "templates")
@Getter
@Setter
public class Template {
    @Id
    private UUID id;
    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;
    @Column(nullable = false)
    private String key;
    @Column(nullable = false)
    private String name;
    private String description;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @OneToMany(mappedBy = "templateId", fetch = FetchType.LAZY)
    @OrderBy("stepOrder ASC")
    private List<StepDef> steps = new ArrayList<>();
}
