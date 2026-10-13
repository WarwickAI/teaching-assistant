package api

import (
	"crypto/subtle"
	"net/http"
	"regexp"
)

// requireInternal rejects requests that don't carry the token shared with SvelteKit.
func requireInternal(token string, next http.Handler) http.Handler {
	want := []byte("Bearer " + token)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := []byte(r.Header.Get("Authorization"))
		if subtle.ConstantTimeCompare(got, want) != 1 {
			http.Error(w, "unauthorised", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r)
	})
}

var studentIDPattern = regexp.MustCompile(`^[0-9]+$`)

// studentID returns the student SvelteKit has signed in, if the header is valid.
func studentID(r *http.Request) (string, bool) {
	id := r.Header.Get("X-Student-ID")
	return id, studentIDPattern.MatchString(id)
}
