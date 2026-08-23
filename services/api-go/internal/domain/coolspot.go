// Package domain holds the API's entity contracts.
//
// The JSON tags are load-bearing: they mirror the `CoolSpot` interface in
// frontend/src/types/coolspot.ts field for field, so the React store can
// consume an API response without an adapter layer.
package domain

// Category is the normalized kind of a cool spot.
type Category string

const (
	CategoryFountain   Category = "fountain"
	CategoryGreenSpace Category = "green_space"
	CategoryIndoor     Category = "indoor"
	CategoryMist       Category = "mist"
)

// Categories lists every valid category, for request validation.
var Categories = []Category{CategoryFountain, CategoryGreenSpace, CategoryIndoor, CategoryMist}

// IsValidCategory reports whether s names a known category.
func IsValidCategory(s string) bool {
	for _, c := range Categories {
		if string(c) == s {
			return true
		}
	}
	return false
}

// Coordinates is a WGS84 point. Nil on the entity when the source record had none.
type Coordinates struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// CoolSpot is the single domain entity served to the dashboard.
type CoolSpot struct {
	ID             string       `json:"id"`
	Name           string       `json:"name"`
	Category       Category     `json:"category"`
	Arrondissement *string      `json:"arrondissement"`
	Address        string       `json:"address"`
	IsFree         bool         `json:"isFree"`
	Price          string       `json:"price"`
	Coordinates    *Coordinates `json:"coordinates"`
	OpeningHours   *string      `json:"openingHours"`
	IsOpenNow      bool         `json:"isOpenNow"`
	CanopyScore    int          `json:"canopyScore"`
	WaterAccess    bool         `json:"waterAccess"`
	ShadeLevel     string       `json:"shadeLevel"`
	Features       []string     `json:"features"`
	Source         string       `json:"source"`
}

// ArrondissementStat backs the dashboard's per-arrondissement bar chart.
type ArrondissementStat struct {
	Code       string `json:"code"`
	Label      string `json:"label"`
	Total      int    `json:"total"`
	Fountain   int    `json:"fountain"`
	GreenSpace int    `json:"green_space"`
	Indoor     int    `json:"indoor"`
	Mist       int    `json:"mist"`
}

// DatasetLoadReport is one dataset's outcome in the most recent pipeline run.
// Mirrors the interface of the same name in coolSpotService.ts.
type DatasetLoadReport struct {
	Slug            string `json:"slug"`
	Label           string `json:"label"`
	Status          string `json:"status"`
	RawCount        int    `json:"rawCount"`
	NormalizedCount int    `json:"normalizedCount"`
	Error           string `json:"error,omitempty"`
}

// Page is the envelope for every paginated collection response.
type Page[T any] struct {
	Items     []T `json:"items"`
	Total     int `json:"total"`
	Page      int `json:"page"`
	PageSize  int `json:"pageSize"`
	PageCount int `json:"pageCount"`
}
