package api

import (
	"net/http"
	"regexp"
)

var studentIDPattern = regexp.MustCompile(`^[0-9]+$`)

// studentID returns the student SvelteKit has signed in, if the header is valid.
func studentID(r *http.Request) (string, bool) {
	id := r.Header.Get("X-Student-ID")
	return id, studentIDPattern.MatchString(id)
}
