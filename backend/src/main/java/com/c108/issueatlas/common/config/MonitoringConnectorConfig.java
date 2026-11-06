package com.c108.issueatlas.common.config;

import org.apache.catalina.connector.Connector;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.tomcat.servlet.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** 기존 health 주소는 유지하고 지표만 컨테이너 내부의 별도 포트에서 제공한다. */
@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(name = "issue-atlas.monitoring.enabled", havingValue = "true")
public class MonitoringConnectorConfig {
    @Bean
    WebServerFactoryCustomizer<TomcatServletWebServerFactory> monitoringConnector(
            @Value("${issue-atlas.monitoring.port:9091}") int port) {
        if (port < 1024 || port > 65535) {
            throw new IllegalArgumentException("Monitoring port must be between 1024 and 65535");
        }
        return factory -> {
            if (factory.getPort() == port) {
                throw new IllegalArgumentException("Monitoring and API ports must differ");
            }
            Connector connector = new Connector(TomcatServletWebServerFactory.DEFAULT_PROTOCOL);
            connector.setPort(port);
            connector.setProperty("maxThreads", "4");
            connector.setProperty("minSpareThreads", "1");
            factory.addAdditionalConnectors(connector);
        };
    }
}
