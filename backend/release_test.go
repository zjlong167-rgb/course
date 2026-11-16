package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// Each fixture owns its course, users and audit entries. No triggers or changes
// to existing course rows are needed for the two transactional failure cases.
func TestReleaseTransactions(t *testing.T) {
	dsn := os.Getenv("MYSQL_DSN")
	if dsn == "" {
		t.Skip("MYSQL_DSN required")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mustExec := func(query string, args ...any) sql.Result {
		t.Helper()
		r, e := db.Exec(query, args...)
		if e != nil {
			t.Fatal(e)
		}
		return r
	}
	schema, err := compileContract()
	if err != nil {
		t.Fatal(err)
	}
	api := &API{db: db, schema: schema, dir: t.TempDir(), sessions: map[string]session{}, limits: map[string]loginLimit{}}
	for _, role := range []string{"admin", "author"} {
		r := mustExec("INSERT INTO users(username,password_hash,role) VALUES(?,'unused',?)", "s06-"+token()[:12], role)
		id, _ := r.LastInsertId()
		defer mustExec("DELETE FROM users WHERE id=?", id)
		api.sessions[role] = session{fmt.Sprint(id), role, "test", time.Now().Add(time.Hour)}
	}
	router := gin.New()
	api.routes(router)
	server := httptest.NewServer(router)
	defer server.Close()
	slug := "s06-" + token()[:12]
	admin := api.sessions["admin"].User
	r := mustExec("INSERT INTO courses(slug,title,summary,category,owner_id,operation_log) VALUES(?,'fixture','','network',?,'[]')", slug, admin)
	id, _ := r.LastInsertId()
	defer func() {
		mustExec("UPDATE courses SET published_version_id=NULL WHERE id=?", id)
		mustExec("DELETE r FROM course_component_refs r JOIN course_versions v ON r.version_id=v.id WHERE v.course_id=?", id)
		mustExec("DELETE FROM course_versions WHERE course_id=?", id)
		mustExec("DELETE FROM course_drafts WHERE course_id=?", id)
		mustExec("DELETE FROM courses WHERE id=?", id)
	}()
	body, err := os.ReadFile("../samples/valid/tcp.json")
	if err != nil {
		t.Fatal(err)
	}
	mustExec("INSERT INTO course_drafts(course_id,body,updated_by) VALUES(?,?,?)", id, body, admin)
	base := fmt.Sprintf("%s/api/v1/courses/%d", server.URL, id)
	call := func(role, kind, key string, in releaseInput, want int) string {
		t.Helper()
		b, _ := json.Marshal(in)
		req, _ := http.NewRequest("POST", base+"/"+kind, bytes.NewReader(b))
		req.Header.Set("Idempotency-Key", key)
		req.Header.Set("X-CSRF-Token", "test")
		req.AddCookie(&http.Cookie{Name: "course_session", Value: role})
		res, e := http.DefaultClient.Do(req)
		if e != nil {
			t.Error(e)
			return ""
		}
		defer res.Body.Close()
		var out struct {
			VersionID string
			Error     struct {
				Code   string
				Issues []validationIssue
			}
		}
		if e = json.NewDecoder(res.Body).Decode(&out); e != nil {
			t.Error(e)
		}
		if res.StatusCode != want {
			t.Errorf("%s %s status %d want %d (%s)", kind, key, res.StatusCode, want, out.Error.Code)
		}
		if want == 422 && len(out.Error.Issues) == 0 {
			t.Error("missing validation location")
		}
		return out.VersionID
	}
	publish := releaseInput{Revision: "1"}
	state := func() (string, int, int, int) {
		var pointer string
		var n, refs, ops int
		err := db.QueryRow("SELECT COALESCE(published_version_id,''),(SELECT COUNT(*) FROM course_versions WHERE course_id=c.id),(SELECT COUNT(*) FROM course_component_refs r JOIN course_versions v ON r.version_id=v.id WHERE v.course_id=c.id),JSON_LENGTH(operation_log) FROM courses c WHERE id=?", id).Scan(&pointer, &n, &refs, &ops)
		if err != nil {
			t.Fatal(err)
		}
		return pointer, n, refs, ops
	}
	call("author", "publish", "a", publish, 403)
	call("", "publish", "a", publish, 401)
	for _, suffix := range []string{"/versions", "/versions/1", "/versions/1/assets/asset-1"} {
		req, _ := http.NewRequest("GET", base+suffix, nil)
		req.AddCookie(&http.Cookie{Name: "course_session", Value: "author"})
		res, e := http.DefaultClient.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		res.Body.Close()
		if res.StatusCode != 404 {
			t.Fatal("other author", suffix, res.StatusCode)
		}
	}
	// Older or externally damaged persisted drafts are revalidated under the lock.
	checkInvalid := func(raw []byte, path string) {
		t.Helper()
		mustExec("UPDATE course_drafts SET body=? WHERE course_id=?", raw, id)
		req, _ := http.NewRequest("POST", base+"/publish", strings.NewReader(`{"revision":"1"}`))
		req.Header.Set("X-CSRF-Token", "test")
		req.Header.Set("Idempotency-Key", "invalid-fixture")
		req.AddCookie(&http.Cookie{Name: "course_session", Value: "admin"})
		res, e := http.DefaultClient.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		defer res.Body.Close()
		var data struct {
			Error struct{ Issues []validationIssue }
		}
		if e = json.NewDecoder(res.Body).Decode(&data); e != nil {
			t.Fatal(e)
		}
		found := false
		for _, issue := range data.Error.Issues {
			if issue.Path == path {
				found = true
			}
		}
		if res.StatusCode != 422 || !found {
			t.Fatalf("invalid persisted draft: %d missing %s", res.StatusCode, path)
		}
		if p, n, r, o := state(); p != "" || n+r+o != 0 {
			t.Fatal("invalid release mutated pointers")
		}
	}
	var invalid map[string]any
	json.Unmarshal(body, &invalid)
	invalid["formatVersion"] = "2.0.0"
	pack := func() []byte {
		raw, e := json.Marshal(invalid)
		if e != nil {
			t.Fatal(e)
		}
		return raw
	}
	checkInvalid(pack(), "/formatVersion")
	invalid["formatVersion"] = "1.0.0"
	comp := obj(arr(invalid["components"])[0])
	comp["version"] = "1.9.9"
	checkInvalid(pack(), "/components/0/version")
	comp["version"] = "1.1.0"
	sc := obj(arr(obj(arr(invalid["chapters"])[0])["scenes"])[0])
	action := obj(arr(obj(arr(sc["steps"])[0])["actions"])[0])
	original := action["target"]
	action["target"] = "missing"
	checkInvalid(pack(), "/chapters/0/scenes/0/steps/0/actions/0/target")
	action["target"] = original
	action["type"] = "move"
	action["params"] = map[string]any{"x": 100001, "y": 0}
	checkInvalid(pack(), "/chapters/0/scenes/0/steps/0/actions/0/params/x")
	json.Unmarshal(body, &invalid)
	storage := token()
	result := mustExec("INSERT INTO assets(storage_key,original_name,mime_type,byte_size,sha256,uploaded_by) VALUES(?,'fixture','image/png',4,REPEAT('0',64),?)", storage, admin)
	aid, _ := result.LastInsertId()
	defer mustExec("DELETE FROM assets WHERE id=?", aid)
	invalid["assets"] = []map[string]string{{"id": fmt.Sprintf("asset-%d", aid), "purpose": "fixture"}}
	checkInvalid(pack(), "/assets/0/id")
	if err = os.WriteFile(filepath.Join(api.dir, storage), []byte("oops"), 0600); err != nil {
		t.Fatal(err)
	}
	checkInvalid(pack(), "/assets/0/id")
	mustExec("UPDATE course_drafts SET body=? WHERE course_id=?", body, id)
	// Force an actual insert constraint error on this fixture alone.
	mustExec("INSERT INTO course_versions(course_id,version_no,draft_revision,body,asset_refs,request_key,request_hash,published_by) VALUES(?,1,1,?,'[]','retry','x',?)", id, body, admin)
	call("admin", "publish", "retry", publish, 503)
	if p, n, refs, o := state(); p != "" || n != 1 || refs != 0 || o != 0 {
		t.Fatal("partial insert")
	}
	mustExec("DELETE FROM course_versions WHERE course_id=?", id)
	// Oversize audit history trips the guard after the version AND refs insert.
	oversized, _ := json.Marshal([]operation{{Reason: strings.Repeat("x", 1<<20)}})
	mustExec("UPDATE courses SET operation_log=? WHERE id=?", oversized, id)
	call("admin", "publish", "retry", publish, 409)
	if p, n, refs, o := state(); p != "" || n != 0 || refs != 0 || o != 1 {
		t.Fatal("rollback left partial state")
	}
	mustExec("UPDATE courses SET operation_log='[]' WHERE id=?", id)
	// Give this separate API connection its own courses table with a CHECK
	// rejecting pointer updates. Versions and refs still use the real InnoDB
	// tables, including the FK back to the permanent fixture course.
	faultDB, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer faultDB.Close()
	faultDB.SetMaxOpenConns(1)
	for _, stmt := range []string{
		"CREATE TEMPORARY TABLE courses (id BIGINT UNSIGNED PRIMARY KEY, published_version_id BIGINT UNSIGNED CHECK (published_version_id IS NULL), status VARCHAR(20), operation_log JSON) ENGINE=InnoDB",
		"INSERT INTO courses VALUES (?,NULL,'draft','[]')",
	} {
		var args []any
		if strings.Contains(stmt, "?") {
			args = []any{id}
		}
		if _, err = faultDB.Exec(stmt, args...); err != nil {
			t.Fatal(err)
		}
	}
	broken := &API{db: faultDB, schema: schema, dir: api.dir, sessions: api.sessions, limits: map[string]loginLimit{}}
	faultRouter := gin.New()
	broken.routes(faultRouter)
	faultServer := httptest.NewServer(faultRouter)
	normalBase := base
	base = fmt.Sprintf("%s/api/v1/courses/%d", faultServer.URL, id)
	call("admin", "publish", "retry", publish, 503)
	base = normalBase
	faultServer.Close()
	if p, n, r, o := state(); p != "" || n+r+o != 0 {
		t.Fatal("failed pointer UPDATE left partial state")
	}
	first := call("admin", "publish", "retry", publish, 200)
	call("admin", "publish", "retry", releaseInput{Revision: "2"}, 409)
	call("admin", "publish", "stale", releaseInput{Revision: "2"}, 409)
	rollback := releaseInput{VersionID: first, Reason: "检查回滚"}
	call("admin", "rollback", "retry", rollback, 409)
	call("admin", "rollback", "outside", releaseInput{VersionID: "18446744073709551615", Reason: "missing"}, 404)
	second := call("admin", "publish", "next", publish, 200)
	call("admin", "rollback", "back", rollback, 200)
	call("admin", "rollback", "back", rollback, 200)
	call("admin", "rollback", "back", releaseInput{VersionID: first, Reason: "changed"}, 409)
	if result := call("admin", "publish", "next", publish, 200); result != second {
		t.Fatal("lost replay result")
	}
	if p, n, refs, o := state(); p != first || n != 2 || refs != 2 || o != 3 {
		t.Fatal("unexpected replay state", p, n, refs, o)
	}
	var wg sync.WaitGroup
	for i := 0; i < 18; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			switch i % 3 {
			case 0:
				call("admin", "publish", "concurrent", publish, 200)
			case 1:
				call("admin", "publish", fmt.Sprintf("new-%d", i), publish, 200)
			case 2:
				call("admin", "rollback", fmt.Sprintf("back-%d", i), rollback, 200)
			}
		}(i)
	}
	wg.Wait()
	var logBytes []byte
	if err = db.QueryRow("SELECT operation_log FROM courses WHERE id=?", id).Scan(&logBytes); err != nil {
		t.Fatal(err)
	}
	var history []operation
	if err = json.Unmarshal(logBytes, &history); err != nil {
		t.Fatal(err)
	}
	p, n, refs, o := state()
	if n != 9 || refs != 9 || o != 16 || p != history[len(history)-1].To {
		t.Fatal("concurrent state", p, n, refs, o)
	}
	last := ""
	for _, op := range history {
		if last != "" && (op.From == nil || *op.From != last) {
			t.Fatal("broken pointer chain")
		}
		last = op.To
	}
	var valid int
	if err = db.QueryRow("SELECT COUNT(*) FROM course_versions v JOIN course_drafts d ON d.course_id=v.course_id JOIN course_component_refs r ON r.version_id=v.id WHERE d.course_id=? AND v.version_no BETWEEN 1 AND 9 AND v.body=d.body AND d.revision=v.draft_revision AND r.component_type='flow' AND r.component_version='1.1.0'", id).Scan(&valid); err != nil || valid != 9 {
		t.Fatal("immutable history or refs", valid, err)
	}
	t.Log("Insert failure and post-reference audit failure rolled back; retry succeeded. 18 concurrent requests -> 9 total snapshots, 16 connected audit entries, final pointer matches.")
}
