package com.bosch.workshop.config;

import java.net.URI;
import java.net.URISyntaxException;
import javax.sql.DataSource;
import org.springframework.boot.jdbc.autoconfigure.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.util.StringUtils;

/**
 * Render Postgres supplies postgres:// or postgresql:// URLs; Spring JDBC needs jdbc:postgresql://.
 */
@Configuration
public class DataSourceConfig {

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties dataSourceProperties() {
        return new DataSourceProperties() {
            @Override
            public String determineUrl() {
                return normalizeJdbcUrl(super.determineUrl());
            }
        };
    }

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties) {
        return properties.initializeDataSourceBuilder().build();
    }

    static String normalizeJdbcUrl(String url) {
        if (!StringUtils.hasText(url)) {
            return url;
        }
        String trimmed = url.trim();
        if (trimmed.startsWith("jdbc:")) {
            return trimmed;
        }
        if (trimmed.startsWith("postgres://") || trimmed.startsWith("postgresql://")) {
            try {
                URI uri = new URI(trimmed.replace("postgres://", "postgresql://"));
                String userInfo = uri.getUserInfo();
                String host = uri.getHost();
                int port = uri.getPort() > 0 ? uri.getPort() : 5432;
                String path = uri.getPath() == null ? "" : uri.getPath();
                String query = uri.getQuery();
                StringBuilder jdbc = new StringBuilder("jdbc:postgresql://")
                        .append(host)
                        .append(":")
                        .append(port)
                        .append(path);
                if (StringUtils.hasText(query)) {
                    jdbc.append("?").append(query);
                }
                // username/password stay in spring.datasource.username/password from Render
                if (userInfo != null && userInfo.contains(":")) {
                    // if embedded in URL only, leave for properties; Render also sets USER/PASSWORD
                }
                return jdbc.toString();
            } catch (URISyntaxException e) {
                return "jdbc:" + trimmed.replace("postgres://", "postgresql://");
            }
        }
        return trimmed;
    }
}
