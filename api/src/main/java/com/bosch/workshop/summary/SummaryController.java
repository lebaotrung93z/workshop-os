package com.bosch.workshop.summary;

import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions/{sessionId}/summary")
public class SummaryController {
    private final SummaryService summaryService;

    public SummaryController(SummaryService summaryService) {
        this.summaryService = summaryService;
    }

    @PostMapping
    public Map<String, Object> generate(
            @PathVariable UUID sessionId, @RequestHeader("X-Host-Token") String hostToken) {
        return summaryService.generate(sessionId, hostToken);
    }

    @GetMapping
    public Map<String, Object> latest(@PathVariable UUID sessionId) {
        return summaryService.latest(sessionId);
    }
}
