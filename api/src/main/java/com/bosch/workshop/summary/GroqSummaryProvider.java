package com.bosch.workshop.summary;

import com.bosch.workshop.common.ApiException;
import com.bosch.workshop.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class GroqSummaryProvider implements SummaryProvider {
    private final AppProperties props;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public GroqSummaryProvider(
            AppProperties props, RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.props = props;
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    @Override
    public String providerName() {
        return "groq";
    }

    @Override
    public String modelName() {
        return props.getAi().getGroq().getModel();
    }

    @Override
    public Map<String, Object> summarize(WorkshopAggregate aggregate) {
        String apiKey = props.getAi().getGroq().getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            return fallback(aggregate, "groq-missing-key");
        }
        String prompt = buildPrompt(aggregate);
        Map<String, Object> body = Map.of(
                "model", modelName(),
                "temperature", 0.2,
                "messages",
                        List.of(
                                Map.of(
                                        "role",
                                        "system",
                                        "content",
                                        "You summarize workshop outcomes as JSON with keys insights (string array), suggestedActions (array of {title, owner, dueDate}), risks (string array). Return JSON only."),
                                Map.of("role", "user", "content", prompt)));
        try {
            String response = restClientBuilder
                    .build()
                    .post()
                    .uri(props.getAi().getGroq().getBaseUrl() + "/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + apiKey)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(response);
            String content = root.path("choices").path(0).path("message").path("content").asText();
            return parseJson(content);
        } catch (Exception e) {
            return fallback(aggregate, "groq-error: " + e.getMessage());
        }
    }

    static String buildPrompt(WorkshopAggregate aggregate) {
        return "Workshop: " + aggregate.title()
                + "\nEntries:\n- "
                + String.join("\n- ", aggregate.entries())
                + "\nTop voted:\n- "
                + String.join("\n- ", aggregate.topVoted())
                + "\nActions:\n- "
                + String.join("\n- ", aggregate.actions());
    }

    private Map<String, Object> parseJson(String content) throws Exception {
        String cleaned = content.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceAll("^```json\\s*", "").replaceAll("^```\\s*", "").replaceAll("```$", "");
        }
        JsonNode node = objectMapper.readTree(cleaned);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("insights", objectMapper.convertValue(node.path("insights"), List.class));
        result.put("suggestedActions", objectMapper.convertValue(node.path("suggestedActions"), List.class));
        result.put("risks", objectMapper.convertValue(node.path("risks"), List.class));
        return result;
    }

    static Map<String, Object> fallback(WorkshopAggregate aggregate, String note) {
        List<String> insights = new ArrayList<>();
        insights.add("Captured " + aggregate.entries().size() + " inputs for \"" + aggregate.title() + "\".");
        if (!aggregate.topVoted().isEmpty()) {
            insights.add("Top voted theme: " + aggregate.topVoted().get(0));
        }
        if (note != null) {
            insights.add("Provider note: " + note);
        }
        List<Map<String, Object>> actions = new ArrayList<>();
        for (String a : aggregate.actions()) {
            actions.add(Map.of("title", a, "owner", "", "dueDate", ""));
        }
        if (actions.isEmpty() && !aggregate.topVoted().isEmpty()) {
            actions.add(Map.of("title", "Follow up: " + aggregate.topVoted().get(0), "owner", "", "dueDate", ""));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("insights", insights);
        result.put("suggestedActions", actions);
        result.put("risks", List.of("Validate AI suggestions with the facilitator."));
        return result;
    }
}
