package com.bosch.workshop.repository;

import com.bosch.workshop.domain.StepGroup;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StepGroupRepository extends JpaRepository<StepGroup, UUID> {
    List<StepGroup> findByStepDefIdOrderByGroupOrderAsc(UUID stepDefId);
}
