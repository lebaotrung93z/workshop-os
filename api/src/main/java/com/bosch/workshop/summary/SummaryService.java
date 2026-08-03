package com.bosch.workshop.summary;

import com.bosch.workshop.activity.ActivityService;
import com.bosch.workshop.config.AppProperties;
import com.bosch.workshop.domain.AiSummary;
import com.bosch.workshop.domain.SessionStatus;
import com.bosch.workshop.domain.WorkshopSession;
import com.bosch.workshop.realtime.SessionEventPublisher;
import com.bosch.workshop.repository.AiSummaryRepository;
import com.bosch.workshop.repository.InputEntryRepository;
import com.bosch.workshop.session.SessionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SummaryService {
    private final AppProperties props;
    private final GroqSummaryProvider groq;
    private final OllamaSummaryProvider ollama;
    private final SessionService sessionService;
    private final ActivityService activityService;
    private final InputEntryRepository entryRepository;
    private final AiSummaryRepository summaryRepository;
    private final SessionEventPublisher events;
    private final ObjectMapper objectMapper;

    public SummaryService(
            AppProperties props,
            GroqSummaryProvider groq,
            OllamaSummaryProvider ollama,
            SessionService sessionService,
            ActivityService activityService,
            InputEntryRepository entryRepository,
            AiSummaryRepository summaryRepository,
            SessionEventPublisher events,
            ObjectMapper objectMapper) {
        this.props = props;
        this.groq = groq;
        this.ollama = ollama;
        this.sessionService = sessionService;
        this.activityService = activityService;
        this.entryRepository = entryRepository;
        this.summaryRepository = summaryRepository;
        this.events = events;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> generate(UUID sessionId, String hostToken) {
        WorkshopSession session = sessionService.requireSession(sessionId);
        sessionService.assertHost(session, hostToken);
        session.setStatus(SessionStatus.SUMMARIZING);
        List<String> entries = entryRepository.findBySessionIdAndHiddenFalseOrderByCreatedAtAsc(sessionId).stream()
                .map(e -> e.getContent())
                .toList();
        List<String> topVoted = new ArrayList<>();
        if (session.getCurrentStepId() != null) {
            topVoted = activityService.tallyVotes(session.getCurrentStepId()).stream()
                    .limit(5)
                    .map(m -> m.get("content") + " (" + m.get("votes") + ")")
                    .map(Object::toString)
                    .toList();
        }
        List<String> actions = activityService.listActions(sessionId).stream()
                .map(a -> String.valueOf(a.get("action")))
                .toList();
        SummaryProvider.WorkshopAggregate aggregate =
                new SummaryProvider.WorkshopAggregate(session.getTitle(), entries, topVoted, actions);
        SummaryProvider provider = "ollama".equalsIgnoreCase(props.getAi().getProvider()) ? ollama : groq;
        Map<String, Object> insights = provider.summarize(aggregate);
        try {
            AiSummary summary = new AiSummary();
            summary.setId(UUID.randomUUID());
            summary.setSessionId(sessionId);
            summary.setProvider(provider.providerName());
            summary.setModel(provider.modelName());
            summary.setInsightsJson(objectMapper.writeValueAsString(insights));
            summaryRepository.save(summary);
            Map<String, Object> view = toView(summary, insights);
            events.publish(sessionId, "summary.ready", view);
            return view;
        } catch (Exception e) {
            throw new com.bosch.workshop.common.ApiException("Failed to store summary: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public Map<String, Object> latest(UUID sessionId) {
        sessionService.requireSession(sessionId);
        return summaryRepository
                .findFirstBySessionIdOrderByCreatedAtDesc(sessionId)
                .map(s -> {
                    try {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> insights = objectMapper.readValue(s.getInsightsJson(), Map.class);
                        return toView(s, insights);
                    } catch (Exception e) {
                        return Map.<String, Object>of("message", "Corrupt summary");
                    }
                })
                .orElse(Map.of("message", "No summary yet"));
    }

    private Map<String, Object> toView(AiSummary summary, Map<String, Object> insights) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", summary.getId());
        view.put("provider", summary.getProvider());
        view.put("model", summary.getModel());
        view.put("createdAt", summary.getCreatedAt());
        view.put("insights", insights.get("insights"));
        view.put("suggestedActions", insights.get("suggestedActions"));
        view.put("risks", insights.get("risks"));
        return view;
    }
}
