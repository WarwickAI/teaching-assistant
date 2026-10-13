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

# The build reads env vars at runtime, so only rebuild when the web app itself has changed.
if [ ! -d web/build ] || [ -n "$(find web/src web/static web/package.json web/package-lock.json web/vite.config.ts web/tsconfig.json -newer web/build -print -quit)" ]; then
	(cd web && npm run build && touch build)
fi

# Wait for the public URL so the dashboard's QR code can point to it.
# Skip api.trycloudflare.com, which only appears in cloudflared's error messages.
for _ in $(seq 30); do
	TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$tunnel_log" | grep -v '^https://api\.' | head -1)
	[ -n "$TUNNEL_URL" ] || ! kill -0 $tunnel_pid 2>/dev/null && break
	sleep 1
done

# A new hostname takes a few seconds to appear in DNS, and browsers that look it up too early cache the failure.
# Use the local resolver (some networks block outside DNS), but give it a head start as it caches failures for 60s.
if [ -n "$TUNNEL_URL" ]; then
	printf '\n  Waiting for %s to resolve...\n' "$TUNNEL_URL"
	sleep 5
	for _ in $(seq 45); do
		[ -n "$(dig +short "${TUNNEL_URL#https://}" A)" ] && break
		sleep 2
	done
fi
export TUNNEL_URL
if [ -n "$TUNNEL_URL" ]; then
	printf '\n  Public URL: %s\n\n' "$TUNNEL_URL"
else
	printf '\n  No tunnel, serving on http://localhost:5173 only:\n' >&2
	grep -E ' (ERR|WRN) ' "$tunnel_log" | tail -3 >&2
	echo >&2
fi

cd web
# ORIGIN lets SvelteKit's CSRF check accept form posts arriving through the tunnel.
PORT=5173 ORIGIN="${TUNNEL_URL:-http://localhost:5173}" node build
