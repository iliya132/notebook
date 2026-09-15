# syntax=docker/dockerfile:1

FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY backend/gradlew backend/settings.gradle.kts backend/build.gradle.kts ./
COPY backend/gradle ./gradle
RUN sed -i 's/\r$//' gradlew gradle/wrapper/gradle-wrapper.properties \
    && sed -i 's/^networkTimeout=.*/networkTimeout=60000/' gradle/wrapper/gradle-wrapper.properties \
    && chmod +x gradlew \
    && ./gradlew --no-daemon dependencies

COPY backend/src ./src
RUN ./gradlew --no-daemon bootJar

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache curl \
    && addgroup -S notebook \
    && adduser -S notebook -G notebook

COPY --from=build --chown=notebook:notebook /workspace/build/libs/*.jar /app/notebook.jar

USER notebook
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/notebook.jar"]
