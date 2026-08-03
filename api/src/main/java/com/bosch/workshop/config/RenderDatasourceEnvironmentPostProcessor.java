package com.bosch.workshop.config;

import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.util.StringUtils;

/**
 * Early conversion of Render postgres:// URLs so any auto-config that reads
 * spring.datasource.url before our DataSource bean still sees a jdbc: URL.
 */
public class RenderDatasourceEnvironmentPostProcessor implements EnvironmentPostProcessor, Ordered {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String raw = firstNonBlank(
                environment.getProperty("spring.datasource.url"),
                environment.getProperty("SPRING_DATASOURCE_URL"),
                environment.getProperty("DATABASE_URL"));
        if (!StringUtils.hasText(raw) || raw.startsWith("jdbc:")) {
            return;
        }

        String normalized = raw.trim();
        if (normalized.startsWith("postgres://")) {
            normalized = "jdbc:postgresql://" + normalized.substring("postgres://".length());
        } else if (normalized.startsWith("postgresql://")) {
            normalized = "jdbc:postgresql://" + normalized.substring("postgresql://".length());
        } else {
            return;
        }

        Map<String, Object> map = new HashMap<>();
        map.put("spring.datasource.url", normalized);
        // Higher than systemEnvironment so placeholder resolution uses jdbc URL
        environment.getPropertySources().addFirst(new MapPropertySource("renderJdbcNormalize", map));
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value) && !value.contains("${")) {
                return value;
            }
        }
        return null;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }
}
