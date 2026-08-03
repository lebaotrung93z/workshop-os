package com.bosch.workshop.repository;

import com.bosch.workshop.domain.AiSummary;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiSummaryRepository extends JpaRepository<AiSummary, UUID> {
    Optional<AiSummary> findFirstBySessionIdOrderByCreatedAtDesc(UUID sessionId);
}
