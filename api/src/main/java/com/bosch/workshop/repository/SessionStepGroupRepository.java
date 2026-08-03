package com.bosch.workshop.repository;

import com.bosch.workshop.domain.SessionStepGroup;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionStepGroupRepository extends JpaRepository<SessionStepGroup, UUID> {
    List<SessionStepGroup> findBySessionStepIdOrderByGroupOrderAsc(UUID sessionStepId);
}
