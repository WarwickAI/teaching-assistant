# One container runs both the Go API and the SvelteKit app.
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
# The Go API listens only inside the container, on a port that can't clash with Railway's $PORT, which SvelteKit serves on.
ENV ADDRESS=127.0.0.1:9000 GO_API_URL=http://127.0.0.1:9000
# Railway's proxy sets this to the visitor's IP address, which the instructor login's attempt limit goes by.
ENV ADDRESS_HEADER=X-Real-IP
COPY --from=server /server ./server
COPY --from=web /src/package.json ./web/
COPY --from=web /src/node_modules ./web/node_modules
COPY --from=web /src/build ./web/build
COPY entrypoint.sh ./
CMD ["./entrypoint.sh"]
