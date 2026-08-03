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
@Table(name = "session_steps")
@Getter
@Setter
public class SessionStep {
    @Id
    private UUID id;
    @Column(name = "session_id", nullable = false)
    private UUID sessionId;
    @Column(name = "step_def_id")
    private UUID stepDefId;
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
    @Column(nullable = false)
    private String status = "PENDING";

    @OneToMany(mappedBy = "sessionStepId", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @OrderBy("groupOrder ASC")
    private List<SessionStepGroup> groups = new ArrayList<>();
}
