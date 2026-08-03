package com.bosch.workshop.summary;

import java.util.List;
import java.util.Map;

public interface SummaryProvider {
    String providerName();

    String modelName();

    Map<String, Object> summarize(WorkshopAggregate aggregate);

    record WorkshopAggregate(
            String title,
            List<String> entries,
            List<String> topVoted,
            List<String> actions) {}
}
