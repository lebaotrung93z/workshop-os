package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "step_defs")
@Getter
@Setter
public class StepDef {
    @Id
    private UUID id;
    @Column(name = "template_id", nullable = false)
    private UUID templateId;
    @Column(name = "step_order", nullable = false)
    private int stepOrder;
    @Column(nullable = false)
    private String type;
    @Column(nullable = false)
    private String title;
    private String instructions;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private String config = "{}";
    @Column(name = "timer_seconds")
    private Integer timerSeconds;

    @OneToMany(mappedBy = "stepDefId", fetch = FetchType.LAZY)
    @OrderBy("groupOrder ASC")
    private List<StepGroup> groups = new ArrayList<>();
}
