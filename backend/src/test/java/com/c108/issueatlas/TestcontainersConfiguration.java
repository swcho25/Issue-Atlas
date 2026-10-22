package com.c108.issueatlas;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    // 운영과 같은 PostGIS 이미지로 테스트한다. 루트 docker-compose.yml 과 태그를 맞춘다.
    private static final DockerImageName POSTGIS =
            DockerImageName.parse("postgis/postgis:17-3.5-alpine")
                    .asCompatibleSubstituteFor("postgres");

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(POSTGIS);
    }
}
