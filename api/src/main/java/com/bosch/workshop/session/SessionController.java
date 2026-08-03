package com.bosch.workshop.session;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {
    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    public record CreateRequest(UUID templateId, String title) {}

    public record JoinRequest(@NotBlank String displayName) {}

    @PostMapping
    public Map<String, Object> create(@RequestBody CreateRequest request) {
        if (request.templateId() == null) {
            throw new com.bosch.workshop.common.ApiException("templateId is required");
        }
        return sessionService.create(request.templateId(), request.title());
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(
            @PathVariable UUID id, @RequestHeader(value = "X-Host-Token", required = false) String hostToken) {
        return sessionService.getForHost(id, hostToken);
    }

    @GetMapping("/by-code/{code}")
    public Map<String, Object> byCode(@PathVariable String code) {
        return sessionService.getByCode(code);
    }

    @GetMapping("/{id}/display")
    public Map<String, Object> display(@PathVariable UUID id) {
        return sessionService.getDisplay(id);
    }

    @PostMapping("/{code}/join")
    public Map<String, Object> join(@PathVariable String code, @RequestBody JoinRequest request) {
        return sessionService.join(code, request.displayName());
    }

    @PostMapping("/{id}/start")
    public Map<String, Object> start(
            @PathVariable UUID id, @RequestHeader("X-Host-Token") String hostToken) {
        return sessionService.start(id, hostToken);
    }

    @PostMapping("/{id}/advance")
    public Map<String, Object> advance(
            @PathVariable UUID id, @RequestHeader("X-Host-Token") String hostToken) {
        return sessionService.advance(id, hostToken);
    }

    @PostMapping("/{id}/back")
    public Map<String, Object> back(
            @PathVariable UUID id, @RequestHeader("X-Host-Token") String hostToken) {
        return sessionService.back(id, hostToken);
    }

    @PostMapping("/{id}/end")
    public Map<String, Object> end(
            @PathVariable UUID id, @RequestHeader("X-Host-Token") String hostToken) {
        return sessionService.end(id, hostToken);
    }
}
