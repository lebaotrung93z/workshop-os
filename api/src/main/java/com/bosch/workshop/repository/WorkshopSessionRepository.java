package com.bosch.workshop.repository;

import com.bosch.workshop.domain.WorkshopSession;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkshopSessionRepository extends JpaRepository<WorkshopSession, UUID> {
    Optional<WorkshopSession> findByCodeIgnoreCase(String code);
    boolean existsByCodeIgnoreCase(String code);
}
