// Package lesson reads the teacher-editable lesson settings and material.
package lesson

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"go.yaml.in/yaml/v3"
)

// The teacher edits these from the dashboard while the server runs, so they're read on every use.
const (
	configPath = "../config.yaml"
	contextDir = "../context"
)

type Config struct {
	LessonName     string  `yaml:"lesson_name"`
	Model          string  `yaml:"model"`
	SpendingCapUSD float64 `yaml:"spending_cap_usd"`
	Resources      []struct {
		Title string `yaml:"title"`
		URL   string `yaml:"url"`
	} `yaml:"resources"`
}

func ReadConfig() (Config, error) {
	var c Config
	data, err := os.ReadFile(configPath)
	if err != nil {
		return c, err
	}
	return c, yaml.Unmarshal(data, &c)
}

// SystemPrompt gives Claude its role, the lesson's resource links and its Markdown context files.
func SystemPrompt(cfg Config) (string, error) {
	files, err := filepath.Glob(filepath.Join(contextDir, "*.md")) // sorted, so the prompt stays cacheable
	if err != nil {
		return "", err
	}
	var b strings.Builder
	fmt.Fprintf(&b, `You are a Socratic, succinct teaching assistant for workshops run by the Warwick Artificial Intelligence Society. This workshop is %q.
Help students understand ideas and work through exercises themselves. When a student asks about something:
1. The first time, explain it using the wording and examples from the lesson slides, then give a hint or ask a guiding question so the student can take the next step.
2. If they ask again or are still stuck, explain it a different way, such as with a new example or a smaller step, and keep guiding rather than solving.
3. The third time they ask about the same thing, give the answer and explain each step of it.
Keep answers short and use Markdown. Write plainly: never use em dashes (—), and avoid filler such as "Great question!", "I hope this helps" or "Let's dive in", and emoji. Base your answers on the lesson material below where it is relevant.

Use your tools sparingly; most questions need none:
- report_struggle: when a student is still stuck after your first explanation, report it once per topic so the teacher can improve the lesson material. You don't need to mention this to the student.
- web_search: only when the lesson material doesn't cover something you need to check, such as current library documentation.
- code_execution: only when running code would really help, such as checking why a student's code fails.
`, cfg.LessonName)
	if len(cfg.Resources) > 0 {
		b.WriteString("\nPoint students to these lesson resources when they would help:\n<resources>\n")
		for _, r := range cfg.Resources {
			fmt.Fprintf(&b, "- [%s](%s)\n", r.Title, r.URL)
		}
		b.WriteString("</resources>\n")
	}
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			return "", err
		}
		fmt.Fprintf(&b, "\n<lesson_material file=%q>\n%s\n</lesson_material>\n", filepath.Base(f), data)
	}
	return b.String(), nil
}
