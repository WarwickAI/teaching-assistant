# Teaching assistant

![The student page: lesson resources and a chat with the assistant](docs/student.png)

![The instructor dashboard: QR code, lesson settings, ratings, feedback and spending](docs/admin.png)

## Switching the Fly deployment off and on

The web Machine stops itself when idle and wakes on the next request, but the API and the database run until told otherwise. Stop them after a lab, and start them again before the next one, database first:

```sh
fly machine stop 8606e6beed6e48 -a teaching-assistant
fly machine stop 82d10e6f054de8 -a teaching-assistant-db

fly machine start 82d10e6f054de8 -a teaching-assistant-db
fly machine start 8606e6beed6e48 -a teaching-assistant
```

The database keeps its data while stopped. If the IDs change, `fly machine list -a <app>` shows the current ones.
