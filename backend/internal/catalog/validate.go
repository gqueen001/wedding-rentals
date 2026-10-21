package catalog

import (
	"math"
	"slices"
	"strings"
	"unicode/utf8"
)

// Validate checks raw (decoded JSON) against the category's fields. It returns the
// clean attributes (trimmed text, whole numbers, choices in Options order, empty
// optional fields dropped) and field errors keyed "attributes.<key>".
func Validate(c Category, raw map[string]any) (map[string]any, map[string]string) {
	clean := map[string]any{}
	errs := map[string]string{}
	known := map[string]bool{}
	for _, f := range c.Fields {
		known[f.Key] = true
		v, present := raw[f.Key]
		value, code := check(f, v, present)
		if code != "" {
			errs["attributes."+f.Key] = code
		} else if value != nil {
			clean[f.Key] = value
		}
	}
	for key := range raw {
		if !known[key] {
			errs["attributes."+key] = "unknown"
		}
	}
	return clean, errs
}

// check returns the clean value (nil when empty) or an error code.
func check(f Field, v any, present bool) (any, string) {
	empty := !present || v == nil
	switch f.Kind {
	case Text:
		s, ok := v.(string)
		if !empty && !ok {
			return nil, "invalid"
		}
		s = strings.TrimSpace(s)
		if s == "" {
			return nil, required(f)
		}
		if utf8.RuneCountInString(s) > f.MaxLen {
			return nil, "too_long"
		}
		return s, ""
	case Choice:
		s, ok := v.(string)
		if !empty && !ok {
			return nil, "invalid"
		}
		if s == "" {
			return nil, required(f)
		}
		if !slices.Contains(f.Options, s) {
			return nil, "invalid"
		}
		return s, ""
	case Choices:
		list, ok := v.([]any)
		if !empty && !ok {
			return nil, "invalid"
		}
		picked := map[string]bool{}
		for _, item := range list {
			s, ok := item.(string)
			if !ok || !slices.Contains(f.Options, s) {
				return nil, "invalid"
			}
			picked[s] = true
		}
		out := []string{}
		for _, o := range f.Options {
			if picked[o] {
				out = append(out, o)
			}
		}
		if len(out) == 0 {
			return nil, required(f)
		}
		return out, ""
	case Number:
		if empty {
			return nil, required(f)
		}
		n, ok := v.(float64)
		if !ok || n != math.Trunc(n) {
			return nil, "invalid"
		}
		if n < float64(f.Min) {
			return nil, "must_be_positive"
		}
		if n > float64(f.Max) {
			return nil, "too_large"
		}
		return int(n), ""
	}
	return nil, "invalid"
}

func required(f Field) string {
	if f.Required {
		return "required"
	}
	return ""
}
