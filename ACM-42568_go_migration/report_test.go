/* Copyright Contributors to the Open Cluster Management project */

package contract

import (
	"bytes"
	"strings"
	"testing"
)

func TestPrintContractSummary(t *testing.T) {
	catalogSummary.reset()
	catalogSummary.setDetail("fail-case", "status 500")
	catalogSummary.record("ok-case", resultPass)
	catalogSummary.record("soft-case", resultSoft)
	catalogSummary.record("fail-case", resultFail)

	var buf bytes.Buffer
	printContractSummary(&buf)
	out := buf.String()

	if !strings.Contains(out, "Executed: 3") {
		t.Fatalf("expected executed count: %s", out)
	}
	if !strings.Contains(out, "OK") || !strings.Contains(out, "SOFT") || !strings.Contains(out, "FAIL") {
		t.Fatalf("missing summary labels: %s", out)
	}
	if !strings.Contains(out, "ok-case") && !strings.Contains(out, "soft-case") && !strings.Contains(out, "fail-case") {
		t.Fatalf("expected case names in detail lists: %s", out)
	}
}

func TestPrintContractSummaryEmpty(t *testing.T) {
	catalogSummary.reset()
	var buf bytes.Buffer
	printContractSummary(&buf)
	if buf.Len() != 0 {
		t.Fatalf("empty summary should not print: %s", buf.String())
	}
}
