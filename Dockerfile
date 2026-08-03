FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app
COPY api/mvnw .
COPY api/.mvn .mvn
COPY api/pom.xml .
COPY api/src src
RUN chmod +x mvnw && ./mvnw -q -DskipTests package \
  && mv target/*.jar target/app.jar

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
ENV PORT=8080
# Free Render instances are ~512MB; keep the JVM under that ceiling.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=55.0 -XX:InitialRAMPercentage=20.0 -XX:+ExitOnOutOfMemoryError -Djava.security.egd=file:/dev/./urandom"
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
