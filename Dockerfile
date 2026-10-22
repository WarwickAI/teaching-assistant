# One image holds both the Go API and the SvelteKit app; fly.toml runs each as its own process group.
FROM golang:1.27 AS server
WORKDIR /src
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN CGO_ENABLED=0 go build -o /server .

FROM node:24-slim AS web
WORKDIR /src
COPY web/package.json web/package-lock.json web/.npmrc ./
RUN npm ci
COPY web/ ./
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
WORKDIR /app
# The dashboard shows times in the server's time zone.
ENV NODE_ENV=production TZ=Europe/London
COPY --from=server /server ./server
# Go checks TLS certificates against the system's CA bundle, which the slim image leaves out.
COPY --from=server /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=web /src/package.json ./web/
COPY --from=web /src/node_modules ./web/node_modules
COPY --from=web /src/build ./web/build
# No CMD: the [processes] table in fly.toml supplies `./server` and `node web/build`.
