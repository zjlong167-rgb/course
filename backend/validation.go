package main

import (
	"encoding/json"
	"fmt"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"strings"
)

type validationIssue struct {
	Path    string `json:"path"`
	Message string `json:"message"`
}

func compileContract() (*jsonschema.Schema, error) {
	return jsonschema.NewCompiler().Compile("../contracts/course-v1.schema.json")
}
func obj(v any) map[string]any { m, _ := v.(map[string]any); return m }
func arr(v any) []any          { a, _ := v.([]any); return a }
func str(v any) string         { s, _ := v.(string); return s }
func validateBody(schema *jsonschema.Schema, raw json.RawMessage) (map[string]any, []validationIssue) {
	var data any
	if json.Unmarshal(raw, &data) != nil {
		return nil, []validationIssue{{"/", "invalid JSON"}}
	}
	if err := schema.Validate(data); err != nil {
		var issues []validationIssue
		if ve, ok := err.(*jsonschema.ValidationError); ok {
			var walk func(*jsonschema.ValidationError)
			walk = func(e *jsonschema.ValidationError) {
				if len(e.Causes) > 0 {
					for _, child := range e.Causes {
						walk(child)
					}
					return
				}
				path := ""
				for _, key := range e.InstanceLocation {
					path += "/" + strings.ReplaceAll(strings.ReplaceAll(key, "~", "~0"), "/", "~1")
				}
				issues = append(issues, validationIssue{path, e.Error()})
			}
			walk(ve)
		} else {
			issues = append(issues, validationIssue{"/", err.Error()})
		}
		return nil, issues
	}
	c := obj(data)
	issues := []validationIssue{}
	add := func(p, m string) { issues = append(issues, validationIssue{p, m}) }
	ids := map[string]bool{}
	id := func(v any, p string) {
		s := str(v)
		if ids[s] {
			add(p, "duplicate id "+s)
		}
		ids[s] = true
	}
	id(c["id"], "/id")
	assets := map[string]bool{}
	for i, v := range arr(c["assets"]) {
		a := obj(v)
		s := str(a["id"])
		if assets[s] {
			add(fmt.Sprintf("/assets/%d", i), "duplicate reference")
		}
		assets[s] = true
	}
	components := map[string]string{}
	for i, v := range arr(c["components"]) {
		a := obj(v)
		t, ver := str(a["type"]), str(a["version"])
		if components[t] != "" {
			add(fmt.Sprintf("/components/%d", i), "duplicate reference")
		}
		components[t] = ver
		if ver != "1.0.0" && !(t == "flow" && ver == "1.1.0") {
			add(fmt.Sprintf("/components/%d/version", i), "unsupported component version")
		}
	}
	for ci, cv := range arr(c["chapters"]) {
		ch := obj(cv)
		cp := fmt.Sprintf("/chapters/%d", ci)
		id(ch["id"], cp+"/id")
		for si, sv := range arr(ch["scenes"]) {
			sc := obj(sv)
			sp := fmt.Sprintf("%s/scenes/%d", cp, si)
			id(sc["id"], sp+"/id")
			targets := map[string]map[string]any{}
			for _, ov := range arr(sc["objects"]) {
				o := obj(ov)
				targets[str(o["id"])] = o
			}
			for oi, ov := range arr(sc["objects"]) {
				o := obj(ov)
				p := fmt.Sprintf("%s/objects/%d", sp, oi)
				id(o["id"], p+"/id")
				t, comp := str(o["type"]), str(o["component"])
				content := obj(o["content"])
				expected := map[string]string{"node": "flow", "edge": "flow", "packet": "flow", "formula": "formula", "geometry": "geometry", "text": "annotation", "image": "annotation"}[t]
				if components[comp] == "" || comp != expected {
					add(p+"/component", "missing or incompatible component")
				}
				if t == "formula" && str(content["tex"]) == "" {
					add(p+"/content/tex", "missing tex")
				}
				if t == "geometry" && content["points"] == nil {
					add(p+"/content/points", "missing points")
				}
				if t == "image" && !assets[str(content["assetId"])] {
					add(p+"/content/assetId", "missing asset")
				}
				if t == "edge" && (targets[str(content["source"])] == nil || targets[str(content["target"])] == nil) {
					add(p+"/content", "missing endpoint")
				}
				if content["visual"] != nil || content["packet"] != nil {
					if comp != "flow" || components["flow"] != "1.1.0" {
						add(p+"/content", "network content requires flow@1.1.0")
					}
					if content["visual"] != nil && t != "node" {
						add(p+"/content/visual", "visual requires node")
					}
					if content["packet"] != nil {
						packet := obj(content["packet"])
						if t != "packet" {
							add(p+"/content/packet", "requires packet object")
						}
						for _, key := range []string{"source", "target"} {
							n := targets[str(packet[key])]
							nc := obj(n["content"])
							if n == nil || n["type"] != "node" || nc["visual"] == nil || nc["address"] == nil {
								add(p+"/content/packet/"+key, "missing network endpoint")
							}
						}
						if strings.Contains(str(packet["flags"]), "ACK") && packet["ack"] == nil {
							add(p+"/content/packet/ack", "ACK flag requires ack")
						}
					}
				}
			}
			for ti, tv := range arr(sc["steps"]) {
				step := obj(tv)
				p := fmt.Sprintf("%s/steps/%d", sp, ti)
				id(step["id"], p+"/id")
				for ai, av := range arr(step["actions"]) {
					a := obj(av)
					ap := fmt.Sprintf("%s/actions/%d", p, ai)
					id(a["id"], ap+"/id")
					if targets[str(a["target"])] == nil {
						add(ap+"/target", "missing target")
					}
					if a["atMs"].(float64)+a["durationMs"].(float64) > step["durationMs"].(float64) {
						add(ap, "exceeds step")
					}
					if a["type"] != "move" && a["durationMs"].(float64) != 0 {
						add(ap+"/durationMs", "discrete action duration must be zero")
					}
				}
			}
		}
	}
	return c, issues
}
