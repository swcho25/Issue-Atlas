package com.c108.issueatlas.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.c108.issueatlas.TestcontainersConfiguration;
import java.io.IOException;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
            "issue-atlas.monitoring.enabled=true",
            "spring.test.metrics.export=true",
            "server.forward-headers-strategy=framework"
        })
@Import(TestcontainersConfiguration.class)
class MonitoringIntegrationTest {
    private static final int METRICS_PORT = availablePort();
    private final HttpClient client = HttpClient.newHttpClient();
    @LocalServerPort int apiPort;

    @DynamicPropertySource
    static void monitoringPort(DynamicPropertyRegistry properties) {
        properties.add("issue-atlas.monitoring.port", () -> METRICS_PORT);
    }

    @Test
    void metricsArePrivateAndHealthKeepsItsExistingAddress() throws Exception {
        assertThat(get(apiPort, "/actuator/health").statusCode()).isEqualTo(200);
        assertThat(get(apiPort, "/actuator/prometheus").statusCode()).isIn(401, 403);
        HttpResponse<String> metrics = get(METRICS_PORT, "/actuator/prometheus");
        assertThat(metrics.statusCode()).isEqualTo(200);
        assertThat(metrics.body()).contains("jvm_memory_used_bytes", "hikaricp_connections");
        assertThat(get(METRICS_PORT, "/v1/places").statusCode()).isIn(401, 403);
        assertThat(get(METRICS_PORT, "/actuator/env").statusCode()).isIn(401, 403);
        HttpRequest spoofed =
                HttpRequest.newBuilder(
                                URI.create("http://127.0.0.1:" + apiPort + "/actuator/prometheus"))
                        .header("Forwarded", "host=localhost:" + METRICS_PORT + ";proto=http")
                        .header("X-Forwarded-Port", Integer.toString(METRICS_PORT))
                        .GET()
                        .build();
        assertThat(client.send(spoofed, HttpResponse.BodyHandlers.ofString()).statusCode())
                .isIn(401, 403);
    }

    private HttpResponse<String> get(int port, String path) throws Exception {
        return client.send(
                HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).GET().build(),
                HttpResponse.BodyHandlers.ofString());
    }

    private static int availablePort() {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (IOException error) {
            throw new IllegalStateException(error);
        }
    }
}
