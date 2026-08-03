package com.bosch.workshop.session;

import com.bosch.workshop.common.ApiException;
import com.bosch.workshop.common.TokenUtil;
import com.bosch.workshop.domain.*;
import com.bosch.workshop.realtime.SessionEventPublisher;
import com.bosch.workshop.repository.*;
import java.time.Instant;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionService {
    private final WorkshopSessionRepository sessionRepository;
    private final TemplateRepository templateRepository;
    private final StepDefRepository stepDefRepository;
    private final StepGroupRepository stepGroupRepository;
    private final SessionStepRepository sessionStepRepository;
    private final SessionStepGroupRepository sessionStepGroupRepository;
    private final ParticipantRepository participantRepository;
    private final SessionEventPublisher events;

    public SessionService(
            WorkshopSessionRepository sessionRepository,
            TemplateRepository templateRepository,
            StepDefRepository stepDefRepository,
            StepGroupRepository stepGroupRepository,
            SessionStepRepository sessionStepRepository,
            SessionStepGroupRepository sessionStepGroupRepository,
            ParticipantRepository participantRepository,
            SessionEventPublisher events) {
        this.sessionRepository = sessionRepository;
        this.templateRepository = templateRepository;
        this.stepDefRepository = stepDefRepository;
        this.stepGroupRepository = stepGroupRepository;
        this.sessionStepRepository = sessionStepRepository;
        this.sessionStepGroupRepository = sessionStepGroupRepository;
        this.participantRepository = participantRepository;
        this.events = events;
    }

    @Transactional
    public Map<String, Object> create(UUID templateId, String title) {
        Template template = templateRepository
                .findById(templateId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Template not found"));
        String hostToken = TokenUtil.newToken();
        String code = allocateCode();

        WorkshopSession session = new WorkshopSession();
        session.setId(UUID.randomUUID());
        session.setWorkspaceId(template.getWorkspaceId());
        session.setTemplateId(template.getId());
        session.setCode(code);
        session.setTitle(title == null || title.isBlank() ? template.getName() : title.trim());
        session.setStatus(SessionStatus.LOBBY);
        session.setHostTokenHash(TokenUtil.sha256(hostToken));
        sessionRepository.save(session);

        List<StepDef> defs = stepDefRepository.findByTemplateIdOrderByStepOrderAsc(template.getId());
        UUID firstStepId = null;
        for (StepDef def : defs) {
            SessionStep step = new SessionStep();
            step.setId(UUID.randomUUID());
            step.setSessionId(session.getId());
            step.setStepDefId(def.getId());
            step.setStepOrder(def.getStepOrder());
            step.setType(def.getType());
            step.setTitle(def.getTitle());
            step.setInstructions(def.getInstructions());
            step.setConfig(def.getConfig() == null ? "{}" : def.getConfig());
            step.setStatus("PENDING");
            sessionStepRepository.save(step);
            if (firstStepId == null) {
                firstStepId = step.getId();
            }
            for (StepGroup group : stepGroupRepository.findByStepDefIdOrderByGroupOrderAsc(def.getId())) {
                SessionStepGroup sg = new SessionStepGroup();
                sg.setId(UUID.randomUUID());
                sg.setSessionStepId(step.getId());
                sg.setGroupOrder(group.getGroupOrder());
                sg.setTitle(group.getTitle());
                sessionStepGroupRepository.save(sg);
            }
        }
        session.setCurrentStepId(firstStepId);
        session.setUpdatedAt(Instant.now());
        sessionRepository.save(session);

        Map<String, Object> body = toSessionView(session, true);
        body.put("hostToken", hostToken);
        return body;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getForHost(UUID id, String hostToken) {
        WorkshopSession session = requireSession(id);
        assertHost(session, hostToken);
        return toSessionView(session, true);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getByCode(String code) {
        WorkshopSession session = sessionRepository
                .findByCodeIgnoreCase(code)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Session not found"));
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", session.getId());
        view.put("code", session.getCode());
        view.put("title", session.getTitle());
        view.put("status", session.getStatus());
        view.put("participantCount", participantRepository.countBySessionId(session.getId()));
        return view;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getDisplay(UUID id) {
        WorkshopSession session = requireSession(id);
        return toSessionView(session, false);
    }

    @Transactional
    public Map<String, Object> join(String code, String displayName) {
        if (displayName == null || displayName.isBlank()) {
            throw new ApiException("Display name is required");
        }
        WorkshopSession session = sessionRepository
                .findByCodeIgnoreCase(code.trim())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Session not found"));
        if (session.getStatus() == SessionStatus.CLOSED) {
            throw new ApiException("Session is closed");
        }
        String joinToken = TokenUtil.newToken();
        Participant p = new Participant();
        p.setId(UUID.randomUUID());
        p.setSessionId(session.getId());
        p.setDisplayName(displayName.trim());
        p.setJoinTokenHash(TokenUtil.sha256(joinToken));
        participantRepository.save(p);
        events.publish(session.getId(), "participant.joined", Map.of(
                "participantId", p.getId(),
                "displayName", p.getDisplayName(),
                "participantCount", participantRepository.countBySessionId(session.getId())));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sessionId", session.getId());
        result.put("participantId", p.getId());
        result.put("joinToken", joinToken);
        result.put("displayName", p.getDisplayName());
        result.put("code", session.getCode());
        result.put("title", session.getTitle());
        result.put("status", session.getStatus());
        result.put("currentStepId", session.getCurrentStepId());
        return result;
    }

    @Transactional
    public Map<String, Object> start(UUID id, String hostToken) {
        WorkshopSession session = requireSession(id);
        assertHost(session, hostToken);
        List<SessionStep> steps = sessionStepRepository.findBySessionIdOrderByStepOrderAsc(id);
        if (steps.isEmpty()) {
            throw new ApiException("Session has no steps");
        }
        SessionStep first = steps.get(0);
        first.setStatus("ACTIVE");
        sessionStepRepository.save(first);
        session.setCurrentStepId(first.getId());
        session.setStatus(first.getType().equals("welcome") ? SessionStatus.WELCOME : SessionStatus.RUNNING);
        applyTimer(session, first);
        session.setUpdatedAt(Instant.now());
        sessionRepository.save(session);
        Map<String, Object> view = toSessionView(session, true);
        events.publish(id, "step.changed", view);
        return view;
    }

    @Transactional
    public Map<String, Object> advance(UUID id, String hostToken) {
        return move(id, hostToken, 1);
    }

    @Transactional
    public Map<String, Object> back(UUID id, String hostToken) {
        return move(id, hostToken, -1);
    }

    @Transactional
    public Map<String, Object> end(UUID id, String hostToken) {
        WorkshopSession session = requireSession(id);
        assertHost(session, hostToken);
        session.setStatus(SessionStatus.CLOSED);
        session.setUpdatedAt(Instant.now());
        sessionRepository.save(session);
        Map<String, Object> view = toSessionView(session, true);
        events.publish(id, "session.ended", view);
        return view;
    }

    private Map<String, Object> move(UUID id, String hostToken, int delta) {
        WorkshopSession session = requireSession(id);
        assertHost(session, hostToken);
        List<SessionStep> steps = sessionStepRepository.findBySessionIdOrderByStepOrderAsc(id);
        int idx = -1;
        for (int i = 0; i < steps.size(); i++) {
            if (steps.get(i).getId().equals(session.getCurrentStepId())) {
                idx = i;
                break;
            }
        }
        if (idx < 0) {
            idx = 0;
        }
        int next = idx + delta;
        if (next < 0 || next >= steps.size()) {
            throw new ApiException("No further steps in that direction");
        }
        SessionStep current = steps.get(idx);
        current.setStatus("DONE");
        sessionStepRepository.save(current);
        SessionStep target = steps.get(next);
        target.setStatus("ACTIVE");
        sessionStepRepository.save(target);
        session.setCurrentStepId(target.getId());
        session.setStatus(statusForStep(target));
        applyTimer(session, target);
        session.setUpdatedAt(Instant.now());
        sessionRepository.save(session);
        Map<String, Object> view = toSessionView(session, true);
        events.publish(id, "step.changed", view);
        return view;
    }

    private SessionStatus statusForStep(SessionStep step) {
        return switch (step.getType()) {
            case "welcome" -> SessionStatus.WELCOME;
            case "form" -> SessionStatus.ACTIONS;
            default -> SessionStatus.RUNNING;
        };
    }

    private void applyTimer(WorkshopSession session, SessionStep step) {
        // timer from template config not stored on session step; use null unless config has timerSeconds
        session.setTimerEndsAt(null);
    }

    public WorkshopSession requireSession(UUID id) {
        return sessionRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Session not found"));
    }

    public void assertHost(WorkshopSession session, String hostToken) {
        if (hostToken == null || !TokenUtil.sha256(hostToken).equals(session.getHostTokenHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Invalid host token");
        }
    }

    public Participant requireParticipant(UUID sessionId, String joinToken) {
        if (joinToken == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Missing join token");
        }
        return participantRepository
                .findBySessionIdAndJoinTokenHash(sessionId, TokenUtil.sha256(joinToken))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Invalid join token"));
    }

    public Map<String, Object> toSessionView(WorkshopSession session, boolean includeHostMeta) {
        List<SessionStep> steps = sessionStepRepository.findBySessionIdOrderByStepOrderAsc(session.getId());
        List<Map<String, Object>> stepViews = new ArrayList<>();
        Map<String, Object> current = null;
        for (SessionStep step : steps) {
            Map<String, Object> sv = stepView(step);
            stepViews.add(sv);
            if (step.getId().equals(session.getCurrentStepId())) {
                current = sv;
            }
        }
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", session.getId());
        view.put("code", session.getCode());
        view.put("title", session.getTitle());
        view.put("status", session.getStatus());
        view.put("currentStepId", session.getCurrentStepId());
        view.put("currentStep", current);
        view.put("steps", stepViews);
        view.put("timerEndsAt", session.getTimerEndsAt());
        view.put("participantCount", participantRepository.countBySessionId(session.getId()));
        if (includeHostMeta) {
            view.put("workspaceId", session.getWorkspaceId());
            view.put("templateId", session.getTemplateId());
        }
        return view;
    }

    private Map<String, Object> stepView(SessionStep step) {
        List<Map<String, Object>> groups = sessionStepGroupRepository
                .findBySessionStepIdOrderByGroupOrderAsc(step.getId())
                .stream()
                .map(g -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("id", g.getId());
                    m.put("title", g.getTitle());
                    m.put("groupOrder", g.getGroupOrder());
                    return m;
                })
                .toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", step.getId());
        m.put("stepOrder", step.getStepOrder());
        m.put("type", step.getType());
        m.put("title", step.getTitle());
        m.put("instructions", step.getInstructions());
        m.put("config", step.getConfig());
        m.put("status", step.getStatus());
        m.put("groups", groups);
        return m;
    }

    private String allocateCode() {
        for (int i = 0; i < 20; i++) {
            String code = TokenUtil.sessionCode();
            if (!sessionRepository.existsByCodeIgnoreCase(code)) {
                return code;
            }
        }
        throw new ApiException("Unable to allocate session code");
    }
}
