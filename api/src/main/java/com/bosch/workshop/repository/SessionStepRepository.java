package com.bosch.workshop.repository;

import com.bosch.workshop.domain.SessionStep;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionStepRepository extends JpaRepository<SessionStep, UUID> {
    List<SessionStep> findBySessionIdOrderByStepOrderAsc(UUID sessionId);
    Optional<SessionStep> findByIdAndSessionId(UUID id, UUID sessionId);
}
