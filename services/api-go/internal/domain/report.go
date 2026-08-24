package domain

import (
	"regexp"
	"strings"
)

// Report kinds and statuses, mirroring the `citizen_reports` ENUMs.
var (
	reportKinds = map[string]bool{
		"out_of_service": true,
		"crowded":        true,
		"closed":         true,
		"wrong_info":     true,
		"other":          true,
	}

	// Spot ids are namespaced by the pipeline: fountain:123, green:456,
	// facility:789. Validating the shape here means a typo is a 400 rather
	// than a foreign-key error surfacing as a 500.
	spotIDPattern = regexp.MustCompile(`^(fountain|green|facility):[A-Za-z0-9_-]{1,80}$`)
)

// MaxCommentLength matches the column width in the schema.
const MaxCommentLength = 1000

// Report is one problem reported on a spot by a member of the public.
type Report struct {
	ID         int64   `json:"id"`
	SpotID     string  `json:"spotId"`
	Kind       string  `json:"kind"`
	Comment    *string `json:"comment"`
	ReportedAt string  `json:"reportedAt"`
	Status     string  `json:"status"`
}

// NewReport is the request body accepted by the create endpoint.
//
// Status is deliberately absent: a reporter does not get to mark their own
// report confirmed.
type NewReport struct {
	SpotID  string `json:"spotId"`
	Kind    string `json:"kind"`
	Comment string `json:"comment"`
}

// Validate normalizes the payload and reports the first problem with it.
func (n *NewReport) Validate() error {
	n.SpotID = strings.TrimSpace(n.SpotID)
	n.Kind = strings.TrimSpace(n.Kind)
	n.Comment = strings.TrimSpace(n.Comment)

	if n.SpotID == "" {
		return BadRequestError{Msg: "spotId is required"}
	}
	if !spotIDPattern.MatchString(n.SpotID) {
		return BadRequestError{Msg: "spotId must look like fountain:123, green:456 or facility:789"}
	}
	if n.Kind == "" {
		n.Kind = "other"
	}
	if !reportKinds[n.Kind] {
		return BadRequestError{Msg: "kind must be one of: out_of_service, crowded, closed, wrong_info, other"}
	}
	// Count runes, not bytes: the comments are French and a byte limit would
	// reject a shorter accented string than an unaccented one.
	if len([]rune(n.Comment)) > MaxCommentLength {
		return BadRequestError{Msg: "comment is too long"}
	}
	return nil
}

// IsValidSpotID reports whether s has the shape the pipeline assigns.
func IsValidSpotID(s string) bool { return spotIDPattern.MatchString(s) }
