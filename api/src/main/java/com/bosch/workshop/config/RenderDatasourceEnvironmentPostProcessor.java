package com.bosch.workshop.config;

import java.util.HashMap;
import java.util.Map;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.util.StringUtils;

/** Converts Render-style postgres:// URLs to jdbc:postgresql:// before DataSource init. */
public class RenderDatasourceEnvironmentPostProcessor implements EnvironmentPostProcessor {

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String url = environment.getProperty("spring.datasource.url");
        if (!StringUtils.hasText(url) || url.startsWith("jdbc:")) {
            return;
        }
        String normalized = url.trim();
        if (normalized.startsWith("postgres://")) {
            normalized = "jdbc:postgresql://" + normalized.substring("postgres://".length());
        } else if (normalized.startsWith("postgresql://")) {
            normalized = "jdbc:postgresql://" + normalized.substring("postgresql://".length());
        } else {
            return;
        }
        // Strip embedded credentials if present; username/password come from separate env vars on Render
        // jdbc:postgresql://user:pass@host:port/db -> jdbc:postgresql://host:port/db
        int at = normalized.indexOf('@');
        int schemeEnd = normalized.indexOf("://") + 3;
        if (at > schemeEnd) {
            normalized = "jdbc:postgresql://" + normalized.substring(at + 1);
        }
        Map<String, Object> map = new HashMap<>();
        map.put("spring.datasource.url", normalized);
        environment.getPropertySources().addFirst(new MapPropertySource("renderJdbcNormalize", map));
    }
}
