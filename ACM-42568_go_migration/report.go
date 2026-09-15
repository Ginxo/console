/* Copyright Contributors to the Open Cluster Management project */

package contract

import (
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
)

const (
	resultPass = "pass"
	resultFail = "fail"
	resultSoft = "soft"
)

type caseOutcome struct {
	name   string
	status string
	detail string
}

type runSummary struct {
	mu       sync.Mutex
	outcomes []caseOutcome
	details  map[string]string
}

var catalogSummary runSummary

func (s *runSummary) reset() {
	s.mu.Lock()
	s.outcomes = nil
	s.details = map[string]string{}
	s.mu.Unlock()
}

func (s *runSummary) setDetail(name, detail string) {
	s.mu.Lock()
	if s.details == nil {
		s.details = map[string]string{}
	}
	s.details[name] = detail
	s.mu.Unlock()
}

func (s *runSummary) record(name, status string) {
	s.mu.Lock()
	detail := ""
	if s.details != nil {
		detail = s.details[name]
	}
	s.outcomes = append(s.outcomes, caseOutcome{name: name, status: status, detail: detail})
	s.mu.Unlock()
}

func (s *runSummary) snapshot() []caseOutcome {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]caseOutcome, len(s.outcomes))
	copy(out, s.outcomes)
	return out
}

func colorEnabled() bool {
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	return true
}

func ansi(code string, text string) string {
	if !colorEnabled() {
		return text
	}
	return code + text + "\033[0m"
}

func green(text string) string {
	return ansi("\033[32m", text)
}

func red(text string) string {
	return ansi("\033[31m", text)
}

func yellow(text string) string {
	return ansi("\033[33m", text)
}

func bold(text string) string {
	return ansi("\033[1m", text)
}

func printContractSummary(w io.Writer) {
	outcomes := catalogSummary.snapshot()
	if len(outcomes) == 0 {
		return
	}

	var passed, failed, soft int
	var failLines, softLines []string
	for _, o := range outcomes {
		switch o.status {
		case resultPass:
			passed++
		case resultFail:
			failed++
			line := o.name
			if o.detail != "" {
				line += " — " + o.detail
			}
			failLines = append(failLines, line)
		case resultSoft:
			soft++
			line := o.name
			if o.detail != "" {
				line += " — " + o.detail
			}
			softLines = append(softLines, line)
		}
	}

	executed := len(outcomes)
	width := 52
	sep := strings.Repeat("═", width)

	fmt.Fprintln(w)
	fmt.Fprintln(w, bold(sep))
	fmt.Fprintln(w, bold(" Contract test summary"))
	fmt.Fprintln(w, bold(sep))
	fmt.Fprintf(w, " Executed: %d\n", executed)
	fmt.Fprintf(w, " %s: %d\n", green("OK"), passed)
	fmt.Fprintf(w, " %s: %d\n", yellow("SOFT (skipped)"), soft)
	fmt.Fprintf(w, " %s: %d\n", red("FAIL"), failed)
	fmt.Fprintln(w, bold(sep))

	if len(failLines) > 0 {
		fmt.Fprintln(w, red(" Failed:"))
		for _, line := range failLines {
			fmt.Fprintf(w, "   %s\n", red(line))
		}
	}
	if len(softLines) > 0 {
		fmt.Fprintln(w, yellow(" Soft skips (optional upstream missing):"))
		for _, line := range softLines {
			fmt.Fprintf(w, "   %s\n", yellow(line))
		}
	}
	if failed == 0 && soft == 0 {
		fmt.Fprintln(w, green(" All mandatory contract cases passed."))
	} else if failed == 0 {
		fmt.Fprintln(w, green(" Mandatory cases passed.")+" "+yellow(fmt.Sprintf("%d optional case(s) skipped.", soft)))
	} else {
		fmt.Fprintln(w, red(fmt.Sprintf("%d case(s) failed — migration gate not green.", failed)))
	}
	fmt.Fprintln(w, bold(sep))
	fmt.Fprintln(w)
}
