package com.bosch.workshop.template;

import com.bosch.workshop.domain.StepDef;
import com.bosch.workshop.domain.StepGroup;
import com.bosch.workshop.domain.Template;
import com.bosch.workshop.repository.StepDefRepository;
import com.bosch.workshop.repository.StepGroupRepository;
import com.bosch.workshop.repository.TemplateRepository;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/templates")
public class TemplateController {
    private static final UUID DEFAULT_WORKSPACE = UUID.fromString("11111111-1111-1111-1111-111111111111");

    private final TemplateRepository templateRepository;
    private final StepDefRepository stepDefRepository;
    private final StepGroupRepository stepGroupRepository;

    public TemplateController(
            TemplateRepository templateRepository,
            StepDefRepository stepDefRepository,
            StepGroupRepository stepGroupRepository) {
        this.templateRepository = templateRepository;
        this.stepDefRepository = stepDefRepository;
        this.stepGroupRepository = stepGroupRepository;
    }

    @GetMapping
    public List<Map<String, Object>> list() {
        return templateRepository.findByWorkspaceIdOrderByNameAsc(DEFAULT_WORKSPACE).stream()
                .map(this::toView)
                .toList();
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        Template t = templateRepository
                .findById(id)
                .orElseThrow(() -> new com.bosch.workshop.common.ApiException(
                        org.springframework.http.HttpStatus.NOT_FOUND, "Template not found"));
        return toView(t);
    }

    private Map<String, Object> toView(Template t) {
        List<StepDef> steps = stepDefRepository.findByTemplateIdOrderByStepOrderAsc(t.getId());
        List<Map<String, Object>> stepViews = new ArrayList<>();
        for (StepDef s : steps) {
            List<Map<String, Object>> groups = stepGroupRepository
                    .findByStepDefIdOrderByGroupOrderAsc(s.getId())
                    .stream()
                    .map(g -> Map.<String, Object>of(
                            "id", g.getId(), "title", g.getTitle(), "groupOrder", g.getGroupOrder()))
                    .toList();
            Map<String, Object> sv = new LinkedHashMap<>();
            sv.put("id", s.getId());
            sv.put("stepOrder", s.getStepOrder());
            sv.put("type", s.getType());
            sv.put("title", s.getTitle());
            sv.put("instructions", s.getInstructions());
            sv.put("config", s.getConfig());
            sv.put("timerSeconds", s.getTimerSeconds());
            sv.put("groups", groups);
            stepViews.add(sv);
        }
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", t.getId());
        view.put("key", t.getKey());
        view.put("name", t.getName());
        view.put("description", t.getDescription());
        view.put("steps", stepViews);
        return view;
    }
}
