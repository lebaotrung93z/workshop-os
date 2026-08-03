package com.bosch.workshop.config;

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.util.StringUtils;

@Configuration
public class DataSourceConfig {

    @Bean
    @Primary
    public DataSource dataSource(
            @Value("${spring.datasource.url}") String url,
            @Value("${spring.datasource.username}") String username,
            @Value("${spring.datasource.password}") String password) {
        HikariDataSource dataSource = new HikariDataSource();
        JdbcUrl normalized = JdbcUrl.normalize(url, username, password);
        dataSource.setJdbcUrl(normalized.jdbcUrl());
        dataSource.setUsername(normalized.username());
        dataSource.setPassword(normalized.password());
        dataSource.setMaximumPoolSize(2);
        dataSource.setMinimumIdle(1);
        dataSource.setConnectionTimeout(20000);
        return dataSource;
    }

    record JdbcUrl(String jdbcUrl, String username, String password) {
        static JdbcUrl normalize(String rawUrl, String username, String password) {
            if (!StringUtils.hasText(rawUrl)) {
                throw new IllegalStateException("spring.datasource.url / SPRING_DATASOURCE_URL is required");
            }
            String url = rawUrl.trim();
            String user = username;
            String pass = password;

            if (url.startsWith("postgres://")) {
                url = "jdbc:postgresql://" + url.substring("postgres://".length());
            } else if (url.startsWith("postgresql://")) {
                url = "jdbc:postgresql://" + url.substring("postgresql://".length());
            } else if (!url.startsWith("jdbc:")) {
                // Render / libpq style without scheme prefix
                if (url.contains("@") && url.contains("/")) {
                    url = "jdbc:postgresql://" + url;
                } else {
                    throw new IllegalStateException(
                            "Datasource URL must be jdbc:postgresql://... or postgres://... but was: "
                                    + redact(rawUrl));
                }
            }

            // jdbc:postgresql://user:pass@host:5432/db?sslmode=require
            int schemeIdx = url.indexOf("://");
            int at = url.indexOf('@', schemeIdx + 3);
            if (at > schemeIdx) {
                String userInfo = url.substring(schemeIdx + 3, at);
                url = url.substring(0, schemeIdx + 3) + url.substring(at + 1);
                int colon = userInfo.indexOf(':');
                if (colon >= 0) {
                    if (!StringUtils.hasText(user)) {
                        user = userInfo.substring(0, colon);
                    }
                    if (!StringUtils.hasText(pass)) {
                        pass = userInfo.substring(colon + 1);
                    }
                } else if (!StringUtils.hasText(user)) {
                    user = userInfo;
                }
            }

            if (!url.startsWith("jdbc:")) {
                throw new IllegalStateException("Normalized datasource URL must start with jdbc: but was: " + redact(url));
            }
            return new JdbcUrl(url, user, pass);
        }

        private static String redact(String value) {
            return value.replaceAll("://([^/@]+):([^/@]+)@", "://****:****@");
        }
    }
}
