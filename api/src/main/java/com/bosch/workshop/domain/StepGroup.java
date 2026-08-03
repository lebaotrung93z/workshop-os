package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "step_groups")
@Getter
@Setter
public class StepGroup {
    @Id
    private UUID id;
    @Column(name = "step_def_id", nullable = false)
    private UUID stepDefId;
    @Column(name = "group_order", nullable = false)
    private int groupOrder;
    @Column(nullable = false)
    private String title;
}
