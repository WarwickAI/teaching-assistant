# Teaching assistant

While the instructor has the lab turned on, students open the site, give their student ID to the assistant, and chat about the lesson. When it's off, visitors see that no lab is running, and the instructor logs in from there to reach the dashboard. The dashboard turns the lab on and off, presents the site's address and QR code full screen, edits the lesson settings, takes the Markdown lesson material the assistant draws on, and shows feedback and spending.

## Deploy on Railway

1. Create a project with a **Postgres** database and a service from this repository. The service builds from the `Dockerfile`, which runs the Go API and the SvelteKit app together.
2. Set the service's variables:
   - `ANTHROPIC_API_KEY`
   - `INSTRUCTOR_PASSWORD`
   - `INTERNAL_TOKEN`: any long random string, such as the output of `openssl rand -hex 32`
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `MODEL` (optional, defaults to `claude-haiku-5-5`)
   - `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` = `60`, so a redeploy lets replies still being written finish and be saved. Railway's default of 0 stops the old deployment straight away.
3. Under **Networking**, add the custom domain `lab.janlindroos.com` and the DNS records Railway asks for (a CNAME and a TXT record), then set `ORIGIN` = `https://lab.janlindroos.com` in the variables.
4. Under **Settings**, turn on **Serverless**, so the app sleeps after 10 minutes with nobody using it. The first visit after that takes a few seconds while it wakes, and may need a refresh. Leave Postgres awake, as Railway advises against sleeping databases.

Open the site, choose **Log in as instructor**, upload the lesson's `.md` files and press **Turn lab on**, then **Present** to show students where to go.

## Run locally

Requires Go, Node.js and Postgres.

```sh
createdb teaching_assistant
cp .example.env .env          # then fill in ANTHROPIC_API_KEY, INSTRUCTOR_PASSWORD and INTERNAL_TOKEN
(cd web && npm install)

set -a; . ./.env; set +a
(cd server && go run .) &
(cd web && npm run dev)
```

The app runs on http://localhost:5173.
