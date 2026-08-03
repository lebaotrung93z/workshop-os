package com.bosch.workshop.template;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {
    private final TemplateService templateService;

    public TemplateController(TemplateService templateService) {
        this.templateService = templateService;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        return templateService.list();
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        return templateService.get(id);
    }

    @PostMapping
    public Map<String, Object> create(@RequestBody TemplateService.CreateTemplateRequest request) {
        return templateService.create(request);
    }
}
