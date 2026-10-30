FROM eclipse-temurin:21-jdk@sha256:23cc5734ff46e776f51ce66eb9ee08444fd47caabec0a95b7eb6e94be2d3696d AS build
WORKDIR /build
COPY gradlew build.gradle settings.gradle ./
COPY gradle ./gradle
COPY src ./src
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew
# 배포 이미지 빌드. Testcontainers 검증은 별도 CI/개발 환경에서 수행한다.
RUN ./gradlew --no-daemon bootJar
RUN cp build/libs/*-SNAPSHOT.jar /build/app.jar

FROM eclipse-temurin:21-jdk@sha256:23cc5734ff46e776f51ce66eb9ee08444fd47caabec0a95b7eb6e94be2d3696d AS runtime
WORKDIR /app
COPY --from=build --chown=10001:10001 /build/app.jar ./app.jar
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65", "-jar", "/app/app.jar"]
