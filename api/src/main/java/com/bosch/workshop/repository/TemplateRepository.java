package com.bosch.workshop.repository;

import com.bosch.workshop.domain.Template;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TemplateRepository extends JpaRepository<Template, UUID> {
    List<Template> findByWorkspaceIdOrderByNameAsc(UUID workspaceId);
}
