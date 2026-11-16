package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestSemanticParity(t *testing.T) {
	out, err := exec.Command("node", "../scripts/validation-corpus.mjs").CombinedOutput()
	if err != nil {
		t.Fatalf("corpus: %s %v", out, err)
	}
	var cases []struct {
		Name  string
		Body  json.RawMessage
		Valid bool
	}
	if err = json.Unmarshal(out, &cases); err != nil {
		t.Fatal(err)
	}
	schema, err := compileContract()
	if err != nil {
		t.Fatal(err)
	}
	for _, c := range cases {
		t.Run(c.Name, func(t *testing.T) {
			_, issues := validateBody(schema, c.Body)
			if (len(issues) == 0) != c.Valid {
				t.Fatalf("parity failure: %+v", issues)
			}
		})
	}
	t.Logf("JS/Go accepted/rejected same %d cases", len(cases))
}
func TestS03DatabaseHTTP(t *testing.T) {
	dsn := os.Getenv("MYSQL_DSN")
	if dsn == "" {
		t.Skip("MYSQL_DSN required for real MySQL test")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if err = db.Ping(); err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	t.Setenv("ASSET_DIR", t.TempDir())
	t.Setenv("BOOTSTRAP_ADMIN_USER", "")
	if err = setupAPI(r, db); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(r)
	defer server.Close()
	hash, _ := bcrypt.GenerateFromPassword([]byte("integration-pass-123"), bcrypt.MinCost)
	uid := []int64{}
	for i := 0; i < 2; i++ {
		res, e := db.Exec("INSERT INTO users(username,password_hash,role) VALUES(?,?,'author')", fmt.Sprintf("s03-%d-%d", time.Now().UnixNano(), i), string(hash))
		if e != nil {
			t.Fatal(e)
		}
		id, _ := res.LastInsertId()
		uid = append(uid, id)
	}
	courseIDs := []string{}
	defer func() {
		for _, id := range courseIDs {
			db.Exec("DELETE FROM course_drafts WHERE course_id=?", id)
			db.Exec("DELETE FROM courses WHERE id=?", id)
		}
		for _, id := range uid {
			db.Exec("DELETE FROM users WHERE id=?", id)
		}
	}()
	call := func(method, path string, body any, cookie, csrf string) (int, map[string]any, []*http.Cookie) {
		var reader io.Reader
		if body != nil {
			b, _ := json.Marshal(body)
			reader = bytes.NewReader(b)
		}
		req, _ := http.NewRequest(method, server.URL+"/api/v1"+path, reader)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-CSRF-Token", csrf)
		if cookie != "" {
			req.AddCookie(&http.Cookie{Name: "course_session", Value: cookie})
		}
		resp, e := http.DefaultClient.Do(req)
		if e != nil {
			t.Error(e)
			return 0, nil, nil
		}
		defer resp.Body.Close()
		d := map[string]any{}
		json.NewDecoder(resp.Body).Decode(&d)
		return resp.StatusCode, d, resp.Cookies()
	}
	cookies := []string{}
	tokens := []string{}
	for _, id := range uid {
		var name string
		db.QueryRow("SELECT username FROM users WHERE id=?", id).Scan(&name)
		status, d, c := call("POST", "/auth/login", map[string]any{"username": name, "password": "integration-pass-123"}, "", "")
		if status != 200 {
			t.Fatalf("login %d %v", status, d)
		}
		cookies = append(cookies, c[0].Value)
		tokens = append(tokens, d["csrfToken"].(string))
	}
	b, _ := os.ReadFile(filepath.Join("..", "samples", "valid", "tcp.json"))
	var body map[string]any
	json.Unmarshal(b, &body)
	status, d, _ := call("POST", "/courses", map[string]any{"body": body}, cookies[0], tokens[0])
	if status != 201 {
		t.Fatalf("create %d %v", status, d)
	}
	id := d["id"].(string)
	courseIDs = append(courseIDs, id)
	path := "/courses/" + id
	var invalid map[string]any
	if err := json.Unmarshal(b, &invalid); err != nil {
		t.Fatal(err)
	}
	testScene := obj(arr(obj(arr(invalid["chapters"])[0])["scenes"])[0])
	testAction := obj(arr(obj(arr(testScene["steps"])[0])["actions"])[0])
	checkIssue := func(want string) {
		t.Helper()
		code, d, _ := call("POST", path+"/validate", map[string]any{"body": invalid}, cookies[0], tokens[0])
		if code != 422 {
			t.Fatalf("expected 422, got %d", code)
		}
		for _, issue := range arr(obj(d["error"])["issues"]) {
			if obj(issue)["path"] == want {
				return
			}
		}
		t.Fatalf("missing HTTP issue %s in %v", want, d)
	}
	testAction["target"] = "missing"
	checkIssue("/chapters/0/scenes/0/steps/0/actions/0/target")
	testAction["type"] = "move"
	testAction["params"] = map[string]any{"x": 100001, "y": 0}
	checkIssue("/chapters/0/scenes/0/steps/0/actions/0/params/x")
	for _, p := range []string{"/draft", "/preview"} {
		status, _, _ = call("GET", path+p, nil, "", "")
		if status != 401 {
			t.Fatal("anonymous draft", status)
		}
		status, _, _ = call("GET", path+p, nil, cookies[1], tokens[1])
		if status != 404 {
			t.Fatal("other author", status)
		}
	}

	for _, methodPath := range [][2]string{{"PUT", "/draft"}, {"POST", "/validate"}} {
		status, _, _ = call(methodPath[0], path+methodPath[1], map[string]any{"revision": "1", "body": body}, cookies[1], tokens[1])
		if status != 404 {
			t.Fatal("other author write", status)
		}
	}
	status, d, _ = call("GET", "/courses", nil, cookies[1], tokens[1])
	if status != 200 || len(d["courses"].([]any)) != 0 {
		t.Fatal("private list leaked", status, d)
	}
	status, _, _ = call("PUT", path+"/draft", map[string]any{"revision": "1", "body": body}, cookies[0], "")
	if status != 403 {
		t.Fatal("csrf", status)
	}
	var wg sync.WaitGroup
	results := make(chan int, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			code, _, _ := call("PUT", path+"/draft", map[string]any{"revision": "1", "body": body}, cookies[0], tokens[0])
			results <- code
		}()
	}
	wg.Wait()
	close(results)
	success, conflict := 0, 0
	for code := range results {
		if code == 200 {
			success++
		} else if code == 409 {
			conflict++
		} else {
			t.Errorf("save %d", code)
		}
	}
	if success != 1 || conflict != 7 {
		t.Fatalf("success=%d conflict=%d", success, conflict)
	}
	status, d, _ = call("GET", path+"/draft", nil, cookies[0], "")
	if status != 200 || d["revision"] != "2" {
		t.Fatalf("reopen %d %v", status, d)
	}
	body["id"] = "../invalid"
	status, _, _ = call("PUT", path+"/draft", map[string]any{"revision": "2", "body": body}, cookies[0], tokens[0])
	if status != 422 {
		t.Fatal("invalid saved", status)
	}
	call("POST", "/auth/logout", nil, cookies[0], tokens[0])
	status, _, _ = call("GET", path+"/draft", nil, cookies[0], "")
	if status != 401 {
		t.Fatal("revoked cookie", status)
	}
	db.Exec("UPDATE users SET disabled=TRUE WHERE id=?", uid[1])
	status, _, _ = call("GET", "/auth/me", nil, cookies[1], "")
	if status != 401 {
		t.Fatal("disabled session", status)
	}
	t.Log("real MySQL: auth/owner/CSRF/disabled/logout, invalid body, 8 concurrent saves => 1 success + 7 conflicts, durable revision 2")
}
