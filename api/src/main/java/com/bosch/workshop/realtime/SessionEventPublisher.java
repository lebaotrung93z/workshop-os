package com.bosch.workshop.realtime;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
public class SessionEventPublisher {
    private final SimpMessagingTemplate messagingTemplate;

    public SessionEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publish(UUID sessionId, String type, Object data) {
        String destination = "/topic/session/" + sessionId;
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", type);
        payload.put("data", data == null ? Map.of() : data);
        messagingTemplate.convertAndSend(destination, (Object) payload);
    }
}
