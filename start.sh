#!/bin/sh
# Runs the Go API in the background and a production build of the SvelteKit app in the foreground.
# When the app exits (Ctrl-C or "Shut down" on the dashboard), the API is stopped too.
set -e
cd "$(dirname "$0")"

# Generate the secret shared by SvelteKit and Go on first run.
if ! grep -q '^INTERNAL_TOKEN=.' .env; then
	{ grep -v '^INTERNAL_TOKEN=' .env || true; echo "INTERNAL_TOKEN=$(openssl rand -hex 32)"; } > .env.tmp
	mv .env.tmp .env
fi
set -a; . ./.env; set +a

(cd server && go build -o bin/server . && exec bin/server) &
go_pid=$!

tunnel_log=$(mktemp)
cloudflared tunnel --url http://localhost:5173 >"$tunnel_log" 2>&1 &
tunnel_pid=$!
trap 'kill $go_pid $tunnel_pid 2>/dev/null; rm -f "$tunnel_log"' EXIT INT TERM

# Wait for the public URL so the dashboard's QR code can point to it.
for _ in $(seq 30); do
	TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$tunnel_log" | head -1)
	[ -n "$TUNNEL_URL" ] || ! kill -0 $tunnel_pid 2>/dev/null && break
	sleep 1
done
export TUNNEL_URL
[ -z "$TUNNEL_URL" ] || printf '\n  Public URL: %s\n\n' "$TUNNEL_URL"

cd web && npm run build
# ORIGIN lets SvelteKit's CSRF check accept form posts arriving through the tunnel.
PORT=5173 ORIGIN="${TUNNEL_URL:-http://localhost:5173}" node build
