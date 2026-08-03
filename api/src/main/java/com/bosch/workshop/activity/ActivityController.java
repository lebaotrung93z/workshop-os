package com.bosch.workshop.activity;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{sessionId}")
public class ActivityController {
    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    public record EntryRequest(String content, UUID groupId) {}

    public record VoteRequest(UUID entryId) {}

    public record ActionRequest(String action, String owner, LocalDate dueDate, UUID sourceEntryId) {}

    @PostMapping("/entries")
    public Map<String, Object> submitEntry(
            @PathVariable UUID sessionId,
            @RequestHeader("X-Join-Token") String joinToken,
            @RequestBody EntryRequest request) {
        return activityService.submitEntry(sessionId, joinToken, request.groupId(), request.content());
    }

    @DeleteMapping("/entries/{entryId}")
    public Map<String, Object> hideEntry(
            @PathVariable UUID sessionId,
            @PathVariable UUID entryId,
            @RequestHeader("X-Host-Token") String hostToken) {
        return activityService.hideEntry(sessionId, entryId, hostToken);
    }

    @GetMapping("/entries")
    public List<Map<String, Object>> listEntries(
            @PathVariable UUID sessionId, @RequestParam(required = false) UUID stepId) {
        return activityService.listEntries(sessionId, stepId);
    }

    @PostMapping("/votes")
    public Map<String, Object> castVote(
            @PathVariable UUID sessionId,
            @RequestHeader("X-Join-Token") String joinToken,
            @RequestBody VoteRequest request) {
        return activityService.castVote(sessionId, joinToken, request.entryId());
    }

    @GetMapping("/votes/tally")
    public List<Map<String, Object>> tally(
            @PathVariable UUID sessionId, @RequestParam(required = false) UUID stepId) {
        if (stepId != null) {
            return activityService.tallyVotes(stepId);
        }
        var entries = activityService.listEntries(sessionId, null);
        if (entries.isEmpty()) {
            return List.of();
        }
        return activityService.tallyVotes((UUID) entries.get(0).get("sessionStepId"));
    }

    @GetMapping("/steps/{stepId}/votes/tally")
    public List<Map<String, Object>> tallyForStep(
            @PathVariable UUID sessionId, @PathVariable UUID stepId) {
        return activityService.tallyVotes(stepId);
    }

    @GetMapping("/poll/tally")
    public List<Map<String, Object>> pollTally(
            @PathVariable UUID sessionId, @RequestParam(required = false) UUID stepId) {
        return activityService.pollTally(sessionId, stepId);
    }

    @PostMapping("/actions")
    public Map<String, Object> submitAction(
            @PathVariable UUID sessionId,
            @RequestHeader(value = "X-Join-Token", required = false) String joinToken,
            @RequestHeader(value = "X-Host-Token", required = false) String hostToken,
            @RequestBody ActionRequest request) {
        if (hostToken != null && !hostToken.isBlank()) {
            return activityService.upsertActionHost(
                    sessionId, hostToken, request.action(), request.owner(), request.dueDate(), request.sourceEntryId());
        }
        return activityService.submitAction(
                sessionId, joinToken, request.action(), request.owner(), request.dueDate());
    }

    @GetMapping("/actions")
    public List<Map<String, Object>> listActions(@PathVariable UUID sessionId) {
        return activityService.listActions(sessionId);
    }
}
