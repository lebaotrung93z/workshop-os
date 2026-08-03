package com.bosch.workshop.repository;

import com.bosch.workshop.domain.ActionItem;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActionItemRepository extends JpaRepository<ActionItem, UUID> {
    List<ActionItem> findBySessionIdOrderByCreatedAtAsc(UUID sessionId);
}
