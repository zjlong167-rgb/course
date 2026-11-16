package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// Structural schema baseline; S03 semantic parity is exercised in s03_test.go.
func TestContractStructure(t *testing.T) {
	c := jsonschema.NewCompiler()
	schema, err := c.Compile("../contracts/course-v1.schema.json")
	if err != nil {
		t.Fatal(err)
	}
	for _, dir := range []string{"valid", "invalid"} {
		files, err := filepath.Glob("../samples/" + dir + "/*.json")
		if err != nil {
			t.Fatal(err)
		}
		for _, file := range files {
			t.Run(filepath.Base(file), func(t *testing.T) {
				b, err := os.ReadFile(file)
				if err != nil {
					t.Fatal(err)
				}
				var data any
				if err = json.Unmarshal(b, &data); err != nil {
					t.Fatal(err)
				}
				err = schema.Validate(data)
				structuralBad := map[string]bool{"version.json": true, "negative-time.json": true, "move-params.json": true}
				if structuralBad[filepath.Base(file)] {
					if err == nil {
						t.Fatal("invalid shape accepted")
					}
				} else if err != nil {
					t.Fatal(err)
				}
			})
		}
	}
}
