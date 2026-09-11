# syntax=docker/dockerfile:1

FROM maven:3.9.13-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY pom.xml ./
RUN mvn -B -ntp -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -B -ntp -DskipTests package \
    && cp "$(find target -maxdepth 1 -type f -name 'smart-metering-api-*.jar' ! -name '*.original' | head -n 1)" /workspace/app.jar

FROM eclipse-temurin:21-jre-alpine AS runtime

RUN apk add --no-cache curl \
    && addgroup -S smartmetering \
    && adduser -S -G smartmetering -h /app smartmetering

WORKDIR /app

COPY --from=build --chown=smartmetering:smartmetering /workspace/app.jar /app/app.jar

USER smartmetering

EXPOSE 8080

ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -Dfile.encoding=UTF-8"

ENTRYPOINT ["java", "-jar", "/app/app.jar"]