# Teaching assistant

## Setup

Requires Go, Node.js, cloudflared and Postgres.

```sh
createdb teaching_assistant
cp .example.env .env          # then fill in ANTHROPIC_API_KEY
cp config.example.yaml config.yaml  # then set secret_word and the lesson details
(cd web && npm install)
```

## Run

```sh
./start.sh
```

Open the printed public URL, sign in with the `secret_word` from `config.yaml` to reach the teacher dashboard, and press **Start session**. Students join by scanning the QR code.
