#!/bin/bash
# Runs the Go API and the SvelteKit app side by side in the container.
# If either one stops, the other is stopped too, so the container exits and Railway restarts it.
# SIGTERM is passed on to both, so each can finish its requests (Go saves chats still being answered).
./server &
server=$!
node web/build &
web=$!
trap 'kill -TERM $server $web 2>/dev/null' TERM INT

wait -n
status=$?
kill -TERM $server $web 2>/dev/null
wait
exit $status
