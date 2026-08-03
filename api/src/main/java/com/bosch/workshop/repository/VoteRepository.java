package com.bosch.workshop.repository;

import com.bosch.workshop.domain.Vote;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VoteRepository extends JpaRepository<Vote, UUID> {
    long countBySessionStepIdAndParticipantId(UUID sessionStepId, UUID participantId);
    boolean existsByEntryIdAndParticipantId(UUID entryId, UUID participantId);
    List<Vote> findBySessionStepId(UUID sessionStepId);

    @Query("select v.entryId, count(v) from Vote v where v.sessionStepId = :stepId group by v.entryId")
    List<Object[]> tallyByStep(@Param("stepId") UUID stepId);
}
