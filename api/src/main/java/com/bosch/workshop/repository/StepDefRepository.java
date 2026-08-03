package com.bosch.workshop.repository;

import com.bosch.workshop.domain.StepDef;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StepDefRepository extends JpaRepository<StepDef, UUID> {
    List<StepDef> findByTemplateIdOrderByStepOrderAsc(UUID templateId);
}
