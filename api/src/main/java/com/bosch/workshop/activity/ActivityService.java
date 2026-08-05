package com.bosch.workshop.activity;

import com.bosch.workshop.common.ApiException;
import com.bosch.workshop.domain.*;
import com.bosch.workshop.realtime.SessionEventPublisher;
import com.bosch.workshop.repository.*;
import com.bosch.workshop.session.SessionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ActivityService {
    private final SessionService sessionService;
    private final SessionStepRepository sessionStepRepository;
    private final InputEntryRepository entryRepository;
    private final VoteRepository voteRepository;
    private final ActionItemRepository actionItemRepository;
    private final ParticipantRepository participantRepository;
    private final SessionEventPublisher events;
    private final ObjectMapper objectMapper;

    public ActivityService(
            SessionService sessionService,
            SessionStepRepository sessionStepRepository,
            InputEntryRepository entryRepository,
            VoteRepository voteRepository,
            ActionItemRepository actionItemRepository,
            ParticipantRepository participantRepository,
            SessionEventPublisher events,
            ObjectMapper objectMapper) {
        this.sessionService = sessionService;
        this.sessionStepRepository = sessionStepRepository;
        this.entryRepository = entryRepository;
        this.voteRepository = voteRepository;
        this.actionItemRepository = actionItemRepository;
        this.participantRepository = participantRepository;
        this.events = events;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> submitEntry(UUID sessionId, String joinToken, UUID groupId, String content) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        Participant participant = sessionService.requireParticipant(sessionId, joinToken);
        SessionStep step = requireCurrentStep(session);
        if (!"input".equals(step.getType()) && !"poll".equals(step.getType())) {
            throw new ApiException("Current step does not accept entries");
        }
        if (content == null || content.isBlank()) {
            throw new ApiException("Content is required");
        }
        if ("poll".equals(step.getType())) {
            // one vote/answer per participant for poll
            List<InputEntry> existing = entryRepository.findBySessionStepIdAndAuthorId(step.getId(), participant.getId());
            for (InputEntry e : existing) {
                e.setHidden(true);
                entryRepository.save(e);
            }
        }
        boolean anonymous = readAnonymous(step);
        InputEntry entry = new InputEntry();
        entry.setId(UUID.randomUUID());
        entry.setSessionId(sessionId);
        entry.setSessionStepId(step.getId());
        entry.setGroupId(groupId);
        entry.setContent(content.trim());
        entry.setAuthorId(anonymous && "input".equals(step.getType()) ? null : participant.getId());
        entryRepository.save(entry);
        Map<String, Object> view = entryView(entry, participant.getDisplayName(), anonymous);
        events.publish(sessionId, "entry.created", view);
        return view;
    }

    @Transactional
    public Map<String, Object> hideEntry(UUID sessionId, UUID entryId, String hostToken) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        sessionService.assertHost(session, hostToken);
        InputEntry entry = entryRepository
                .findById(entryId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Entry not found"));
        if (!entry.getSessionId().equals(sessionId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "Entry not found");
        }
        entry.setHidden(true);
        entryRepository.save(entry);
        Map<String, Object> payload = Map.of("entryId", entryId, "hidden", true);
        events.publish(sessionId, "entry.hidden", payload);
        return payload;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listEntries(UUID sessionId, UUID stepId) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        UUID sid = stepId != null ? stepId : session.getCurrentStepId();
        SessionStep step = sid == null
                ? null
                : sessionStepRepository.findById(sid).orElse(null);
        Map<UUID, String> names = participantNames(sessionId);
        if (step != null && "voting".equals(step.getType())) {
            return entryRepository.findBySessionIdAndHiddenFalseOrderByCreatedAtAsc(sessionId).stream()
                    .filter(e -> {
                        SessionStep s = sessionStepRepository.findById(e.getSessionStepId()).orElse(null);
                        return s != null && "input".equals(s.getType());
                    })
                    .map(e -> toListedEntry(e, names))
                    .toList();
        }
        if (sid == null) {
            return List.of();
        }
        return entryRepository.findBySessionStepIdAndHiddenFalseOrderByCreatedAtAsc(sid).stream()
                .map(e -> toListedEntry(e, names))
                .toList();
    }

    private Map<UUID, String> participantNames(UUID sessionId) {
        Map<UUID, String> names = new HashMap<>();
        for (Participant p : participantRepository.findBySessionIdOrderByCreatedAtAsc(sessionId)) {
            names.put(p.getId(), p.getDisplayName());
        }
        return names;
    }

    private Map<String, Object> toListedEntry(InputEntry entry, Map<UUID, String> names) {
        boolean anonymous = entry.getAuthorId() == null;
        String authorName = anonymous ? null : names.get(entry.getAuthorId());
        return entryView(entry, authorName, anonymous);
    }

    @Transactional
    public Map<String, Object> castVote(UUID sessionId, String joinToken, UUID entryId) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        Participant participant = sessionService.requireParticipant(sessionId, joinToken);
        SessionStep step = requireCurrentStep(session);
        if (!"voting".equals(step.getType())) {
            throw new ApiException("Current step is not voting");
        }
        InputEntry entry = entryRepository
                .findById(entryId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Entry not found"));
        if (entry.isHidden() || !entry.getSessionId().equals(sessionId)) {
            throw new ApiException("Entry is not votable");
        }
        if (voteRepository.existsByEntryIdAndParticipantId(entryId, participant.getId())) {
            throw new ApiException("Already voted for this entry");
        }
        int budget = readVoteBudget(step);
        long used = voteRepository.countBySessionStepIdAndParticipantId(step.getId(), participant.getId());
        if (used >= budget) {
            throw new ApiException("Vote budget exhausted (" + budget + ")");
        }
        Vote vote = new Vote();
        vote.setId(UUID.randomUUID());
        vote.setSessionId(sessionId);
        vote.setSessionStepId(step.getId());
        vote.setEntryId(entryId);
        vote.setParticipantId(participant.getId());
        voteRepository.save(vote);
        List<Map<String, Object>> tally = tallyVotes(sessionId, step.getId());
        events.publish(sessionId, "vote.updated", Map.of("tally", tally, "votesRemaining", budget - used - 1));
        return Map.of("ok", true, "votesRemaining", budget - used - 1, "tally", tally);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> tallyVotes(UUID sessionId, UUID votingStepId) {
        Map<UUID, Long> counts = new HashMap<>();
        for (Object[] row : voteRepository.tallyByStep(votingStepId)) {
            counts.put((UUID) row[0], (Long) row[1]);
        }
        return listEntries(sessionId, votingStepId).stream()
                .map(e -> {
                    UUID entryId = (UUID) e.get("id");
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("entryId", entryId);
                    m.put("content", e.get("content"));
                    m.put("groupId", e.get("groupId"));
                    m.put("votes", counts.getOrDefault(entryId, 0L));
                    return m;
                })
                .sorted((a, b) -> Long.compare((Long) b.get("votes"), (Long) a.get("votes")))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> tallyVotes(UUID stepId) {
        SessionStep step = sessionStepRepository
                .findById(stepId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Step not found"));
        return tallyVotes(step.getSessionId(), stepId);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> pollTally(UUID sessionId, UUID stepId) {
        sessionService.requireSession(sessionId);
        WorkshopSession session = sessionService.requireSession(sessionId);
        UUID sid = stepId != null ? stepId : session.getCurrentStepId();
        SessionStep step = sessionStepRepository
                .findById(sid)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Step not found"));
        Map<String, Long> counts = new LinkedHashMap<>();
        for (InputEntry e : entryRepository.findBySessionStepIdAndHiddenFalseOrderByCreatedAtAsc(sid)) {
            counts.merge(e.getContent(), 1L, Long::sum);
        }
        List<Map<String, Object>> options = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(step.getConfig() == null ? "{}" : step.getConfig());
            for (JsonNode opt : root.path("options")) {
                String id = opt.path("id").asText();
                options.add(Map.of(
                        "id", id,
                        "label", opt.path("label").asText(id),
                        "count", counts.getOrDefault(id, 0L)));
            }
        } catch (Exception e) {
            counts.forEach((k, v) -> options.add(Map.of("id", k, "label", k, "count", v)));
        }
        return options;
    }

    @Transactional
    public Map<String, Object> submitAction(
            UUID sessionId, String joinToken, String action, String owner, LocalDate dueDate) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        sessionService.requireParticipant(sessionId, joinToken);
        if (action == null || action.isBlank()) {
            throw new ApiException("Action is required");
        }
        ActionItem item = new ActionItem();
        item.setId(UUID.randomUUID());
        item.setSessionId(sessionId);
        item.setAction(action.trim());
        item.setOwner(owner);
        item.setDueDate(dueDate);
        actionItemRepository.save(item);
        Map<String, Object> view = actionView(item);
        events.publish(sessionId, "action.created", view);
        return view;
    }

    @Transactional
    public Map<String, Object> upsertActionHost(
            UUID sessionId, String hostToken, String action, String owner, LocalDate dueDate, UUID sourceEntryId) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        sessionService.assertHost(session, hostToken);
        ActionItem item = new ActionItem();
        item.setId(UUID.randomUUID());
        item.setSessionId(sessionId);
        item.setAction(action);
        item.setOwner(owner);
        item.setDueDate(dueDate);
        item.setSourceEntryId(sourceEntryId);
        actionItemRepository.save(item);
        Map<String, Object> view = actionView(item);
        events.publish(sessionId, "action.created", view);
        return view;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listActions(UUID sessionId) {
        sessionService.requireSession(sessionId);
        return actionItemRepository.findBySessionIdOrderByCreatedAtAsc(sessionId).stream()
                .map(this::actionView)
                .toList();
    }

    private SessionStep requireCurrentStep(WorkshopSession session) {
        if (session.getCurrentStepId() == null) {
            throw new ApiException("No active step");
        }
        return sessionStepRepository
                .findById(session.getCurrentStepId())
                .orElseThrow(() -> new ApiException("Active step missing"));
    }

    private boolean readAnonymous(SessionStep step) {
        try {
            JsonNode root = objectMapper.readTree(step.getConfig() == null ? "{}" : step.getConfig());
            return root.path("anonymous").asBoolean(false);
        } catch (Exception e) {
            return false;
        }
    }

    private int readVoteBudget(SessionStep step) {
        try {
            JsonNode root = objectMapper.readTree(step.getConfig() == null ? "{}" : step.getConfig());
            return root.path("votesPerParticipant").asInt(3);
        } catch (Exception e) {
            return 3;
        }
    }

    private Map<String, Object> entryView(InputEntry entry, String authorName, boolean anonymous) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", entry.getId());
        m.put("sessionStepId", entry.getSessionStepId());
        m.put("groupId", entry.getGroupId());
        m.put("content", entry.getContent());
        m.put("authorId", anonymous ? null : entry.getAuthorId());
        m.put("authorName", anonymous ? null : authorName);
        m.put("createdAt", entry.getCreatedAt());
        return m;
    }

    private Map<String, Object> actionView(ActionItem item) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", item.getId());
        m.put("action", item.getAction());
        m.put("owner", item.getOwner());
        m.put("dueDate", item.getDueDate());
        m.put("sourceEntryId", item.getSourceEntryId());
        m.put("createdAt", item.getCreatedAt());
        return m;
    }
}
