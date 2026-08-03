package com.bosch.workshop.domain;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "session_step_groups")
@Getter
@Setter
public class SessionStepGroup {
    @Id
    private UUID id;
    @Column(name = "session_step_id", nullable = false)
    private UUID sessionStepId;
    @Column(name = "group_order", nullable = false)
    private int groupOrder;
    @Column(nullable = false)
    private String title;
}
