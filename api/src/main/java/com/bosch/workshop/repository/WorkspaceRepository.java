package com.bosch.workshop.repository;

import com.bosch.workshop.domain.Workspace;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {}
