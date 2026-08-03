package com.bosch.workshop.repository;

import com.bosch.workshop.domain.Participant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParticipantRepository extends JpaRepository<Participant, UUID> {
    List<Participant> findBySessionIdOrderByCreatedAtAsc(UUID sessionId);
    long countBySessionId(UUID sessionId);
    Optional<Participant> findByIdAndSessionId(UUID id, UUID sessionId);
    Optional<Participant> findBySessionIdAndJoinTokenHash(UUID sessionId, String joinTokenHash);
}
