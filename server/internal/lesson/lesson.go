// Package lesson builds the assistant's instructions from the teacher's lesson settings and material.
package lesson

import (
	"encoding/json"
	"fmt"
	"strings"

	"teaching-assistant/server/internal/db"
)

type Resource struct {
	Title string `json:"title"`
	URL   string `json:"url"`
}

// SystemPrompt gives Claude its role, the lesson's resource links and its Markdown context files.
// The files should be sorted, so the prompt stays cacheable.
func SystemPrompt(settings db.Setting, files []db.ContextFile) (string, error) {
	var resources []Resource
	if err := json.Unmarshal(settings.Resources, &resources); err != nil {
		return "", err
	}
	var b strings.Builder
	fmt.Fprintf(&b, `You are a Socratic, succinct teaching assistant for workshops run by the Warwick Artificial Intelligence Society. This workshop is %q.
Help students understand ideas and work through exercises themselves. When a student asks about something, explain it using the wording and examples from the lesson slides, then give a hint or ask a guiding question so the student can take the next step, and ask whether they would like another hint or the answer. If they ask for the answer, give it and explain each step of it.
Be concise: a few short sentences or a short list is usually enough, so leave out anything the student doesn't need for their next step. Use Markdown. Write plainly: never use em dashes (—), and avoid filler such as "Great question!", "I hope this helps" or "Let's dive in", and emoji. Base your answers on the lesson material below where it is relevant.

Use your tools sparingly; most questions need none:
- report_struggle: whenever a student's question is more than a clarifying one, report it so the teacher can improve the lesson material, once per topic. You don't need to mention this to the student.
- web_search: only when the lesson material doesn't cover something you need to check, such as current library documentation.
- code_execution: only when running code would really help, such as checking why a student's code fails.
`, settings.LessonName)
	if len(resources) > 0 {
		b.WriteString("\nPoint students to these lesson resources when they would help:\n<resources>\n")
		for _, r := range resources {
			fmt.Fprintf(&b, "- [%s](%s)\n", r.Title, r.URL)
		}
		b.WriteString("</resources>\n")
	}
	for _, f := range files {
		fmt.Fprintf(&b, "\n<lesson_material file=%q>\n%s\n</lesson_material>\n", f.Name, f.Content)
	}
	return b.String(), nil
}
