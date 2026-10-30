package com.c108.issueatlas;

import java.nio.file.Path;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.images.builder.ImageFromDockerfile;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {

    // 로컬·배포 Compose 와 같은 Dockerfile 을 사용해 pgvector 설치도 검사한다.
    private static final DockerImageName POSTGIS_PGVECTOR =
            DockerImageName.parse(
                            new ImageFromDockerfile(
                                            "issueatlas-postgres:17-3.5-pgvector-0.8.7", false)
                                    .withDockerfile(Path.of("../database/Dockerfile"))
                                    .get())
                    .asCompatibleSubstituteFor("postgres");

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return new PostgreSQLContainer(POSTGIS_PGVECTOR);
    }
}
