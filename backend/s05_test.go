package main

import (
	"encoding/json"
	"os"
	"testing"
)

func TestS05ValidationLocations(t *testing.T) {
	schema, err := compileContract()
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../samples/valid/tcp.json")
	if err != nil {
		t.Fatal(err)
	}
	var c map[string]any
	if err = json.Unmarshal(raw, &c); err != nil {
		t.Fatal(err)
	}
	scene := obj(arr(obj(arr(c["chapters"])[0])["scenes"])[0])
	a := obj(arr(obj(arr(scene["steps"])[0])["actions"])[0])
	check := func(path string) {
		t.Helper()
		raw, err := json.Marshal(c)
		if err != nil {
			t.Fatal(err)
		}
		_, issues := validateBody(schema, raw)
		for _, v := range issues {
			if v.Path == path {
				return
			}
		}
		t.Fatalf("missing %s in %+v", path, issues)
	}
	a["target"] = "missing"
	check("/chapters/0/scenes/0/steps/0/actions/0/target")
	a["type"] = "move"
	a["params"] = map[string]any{"x": 100001, "y": 0}
	check("/chapters/0/scenes/0/steps/0/actions/0/params/x")
}
