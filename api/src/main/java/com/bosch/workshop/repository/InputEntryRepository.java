package com.bosch.workshop.repository;

import com.bosch.workshop.domain.InputEntry;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InputEntryRepository extends JpaRepository<InputEntry, UUID> {
    List<InputEntry> findBySessionStepIdAndHiddenFalseOrderByCreatedAtAsc(UUID sessionStepId);
    List<InputEntry> findBySessionIdAndHiddenFalseOrderByCreatedAtAsc(UUID sessionId);
    List<InputEntry> findBySessionStepIdAndAuthorId(UUID sessionStepId, UUID authorId);
}
