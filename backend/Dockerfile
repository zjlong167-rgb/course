FROM golang:1.26.1-bookworm AS build
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -o /out/course-api . && CGO_ENABLED=0 go build -trimpath -o /out/migrate ./cmd/migrate
FROM alpine:3.23.3
RUN apk add --no-cache ca-certificates && adduser -D -u 10001 course
WORKDIR /app/backend
COPY --from=build /out/ /app/bin/
COPY backend/migrations/ ./migrations/
COPY contracts/ /app/contracts/
RUN mkdir -p /data/assets && chown course:course /data/assets
USER course
ENV LISTEN_ADDR=0.0.0.0:8080 ASSET_DIR=/data/assets GIN_MODE=release
EXPOSE 8080
CMD ["/app/bin/course-api"]
