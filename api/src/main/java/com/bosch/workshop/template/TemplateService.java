package com.bosch.workshop.template;

import com.bosch.workshop.common.ApiException;
import com.bosch.workshop.domain.StepDef;
import com.bosch.workshop.domain.StepGroup;
import com.bosch.workshop.domain.Template;
import com.bosch.workshop.repository.StepDefRepository;
import com.bosch.workshop.repository.StepGroupRepository;
import com.bosch.workshop.repository.TemplateRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.util.Locale;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TemplateService {
    private static final UUID DEFAULT_WORKSPACE = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final Set<String> ALLOWED_TYPES =
            Set.of("welcome", "poll", "input", "voting", "form");

    private final TemplateRepository templateRepository;
    private final StepDefRepository stepDefRepository;
    private final StepGroupRepository stepGroupRepository;
    private final ObjectMapper objectMapper;

    public TemplateService(
            TemplateRepository templateRepository,
            StepDefRepository stepDefRepository,
            StepGroupRepository stepGroupRepository,
            ObjectMapper objectMapper) {
        this.templateRepository = templateRepository;
        this.stepDefRepository = stepDefRepository;
        this.stepGroupRepository = stepGroupRepository;
        this.objectMapper = objectMapper;
    }

    public List<Map<String, Object>> list() {
        return templateRepository.findByWorkspaceIdOrderByNameAsc(DEFAULT_WORKSPACE).stream()
                .map(this::toView)
                .toList();
    }

    public Map<String, Object> get(UUID id) {
        Template t = templateRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Template not found"));
        return toView(t);
    }

    @Transactional
    public Map<String, Object> create(CreateTemplateRequest req) {
        if (req == null || !StringUtils.hasText(req.name())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Format name is required");
        }
        if (req.steps() == null || req.steps().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Add at least one step");
        }

        Template template = new Template();
        template.setId(UUID.randomUUID());
        template.setWorkspaceId(DEFAULT_WORKSPACE);
        template.setKey(uniqueKey(req.name()));
        template.setName(req.name().trim());
        template.setDescription(StringUtils.hasText(req.description()) ? req.description().trim() : "Custom format");
        template.setCreatedAt(Instant.now());
        templateRepository.save(template);

        int order = 1;
        for (StepRequest step : req.steps()) {
            if (step == null || !StringUtils.hasText(step.type()) || !StringUtils.hasText(step.title())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Each step needs a type and title");
            }
            String type = step.type().trim().toLowerCase(Locale.ROOT);
            if (!ALLOWED_TYPES.contains(type)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Unsupported step type: " + step.type());
            }

            StepDef def = new StepDef();
            def.setId(UUID.randomUUID());
            def.setTemplateId(template.getId());
            def.setStepOrder(order++);
            def.setType(type);
            def.setTitle(step.title().trim());
            def.setInstructions(step.instructions());
            def.setTimerSeconds(step.timerSeconds());
            def.setConfig(normalizeConfig(type, step.config()));
            stepDefRepository.save(def);

            if ("input".equals(type)) {
                List<GroupRequest> groups = step.groups() == null ? List.of() : step.groups();
                if (groups.isEmpty()) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Input steps need at least one column");
                }
                int gOrder = 1;
                for (GroupRequest g : groups) {
                    if (g == null || !StringUtils.hasText(g.title())) {
                        throw new ApiException(HttpStatus.BAD_REQUEST, "Column title is required");
                    }
                    StepGroup group = new StepGroup();
                    group.setId(UUID.randomUUID());
                    group.setStepDefId(def.getId());
                    group.setGroupOrder(gOrder++);
                    group.setTitle(g.title().trim());
                    stepGroupRepository.save(group);
                }
            }
        }

        return toView(template);
    }

    private String uniqueKey(String name) {
        String base = name.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (!StringUtils.hasText(base)) {
            base = "custom";
        }
        if (base.length() > 40) {
            base = base.substring(0, 40);
        }
        return base + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String normalizeConfig(String type, Object config) {
        try {
            Map<String, Object> map = config == null
                    ? new LinkedHashMap<>()
                    : objectMapper.convertValue(config, Map.class);
            if (map == null) {
                map = new LinkedHashMap<>();
            }
            if ("poll".equals(type)) {
                Object options = map.get("options");
                if (!(options instanceof List<?> list) || list.size() < 2) {
                    throw new ApiException(HttpStatus.BAD_REQUEST, "Poll steps need at least 2 options");
                }
            }
            if ("voting".equals(type) && !map.containsKey("votesPerParticipant")) {
                map.put("votesPerParticipant", 3);
            }
            if ("input".equals(type) && !map.containsKey("anonymous")) {
                map.put("anonymous", true);
            }
            return objectMapper.writeValueAsString(map);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid step config");
        }
    }

    public Map<String, Object> toView(Template t) {
        List<StepDef> steps = stepDefRepository.findByTemplateIdOrderByStepOrderAsc(t.getId());
        List<Map<String, Object>> stepViews = new ArrayList<>();
        for (StepDef s : steps) {
            List<Map<String, Object>> groups = stepGroupRepository
                    .findByStepDefIdOrderByGroupOrderAsc(s.getId())
                    .stream()
                    .map(g -> Map.<String, Object>of(
                            "id", g.getId(), "title", g.getTitle(), "groupOrder", g.getGroupOrder()))
                    .collect(Collectors.toList());
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

    public record CreateTemplateRequest(String name, String description, List<StepRequest> steps) {}

    public record StepRequest(
            String type,
            String title,
            String instructions,
            Integer timerSeconds,
            Object config,
            List<GroupRequest> groups) {}

    public record GroupRequest(String title) {}
}
