package com.bosch.workshop.summary;

import com.bosch.workshop.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class OllamaSummaryProvider implements SummaryProvider {
    private final AppProperties props;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    public OllamaSummaryProvider(
            AppProperties props, RestClient.Builder restClientBuilder, ObjectMapper objectMapper) {
        this.props = props;
        this.restClientBuilder = restClientBuilder;
        this.objectMapper = objectMapper;
    }

    @Override
    public String providerName() {
        return "ollama";
    }

    @Override
    public String modelName() {
        return props.getAi().getOllama().getModel();
    }

    @Override
    public Map<String, Object> summarize(WorkshopAggregate aggregate) {
        String prompt = GroqSummaryProvider.buildPrompt(aggregate)
                + "\nRespond with JSON only: insights[], suggestedActions[{title,owner,dueDate}], risks[].";
        Map<String, Object> body = Map.of(
                "model", modelName(),
                "stream", false,
                "prompt", prompt,
                "format", "json");
        try {
            String response = restClientBuilder
                    .build()
                    .post()
                    .uri(props.getAi().getOllama().getBaseUrl() + "/api/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            JsonNode root = objectMapper.readTree(response);
            String content = root.path("response").asText();
            JsonNode node = objectMapper.readTree(content);
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("insights", objectMapper.convertValue(node.path("insights"), List.class));
            result.put("suggestedActions", objectMapper.convertValue(node.path("suggestedActions"), List.class));
            result.put("risks", objectMapper.convertValue(node.path("risks"), List.class));
            return result;
        } catch (Exception e) {
            return GroqSummaryProvider.fallback(aggregate, "ollama-error: " + e.getMessage());
        }
    }
}
