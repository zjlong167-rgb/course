package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"golang.org/x/crypto/bcrypt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

type session struct {
	User, Role, CSRF string
	Expires          time.Time
}
type loginLimit struct {
	Count int
	Until time.Time
}
type API struct {
	db       *sql.DB
	schema   *jsonschema.Schema
	dir      string
	secure   bool
	mu       sync.Mutex
	sessions map[string]session
	limits   map[string]loginLimit
}

func token() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func fail(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": code, "message": message}, "requestId": token()})
}
func (a *API) databaseError(c *gin.Context, err error) {
	if errors.Is(err, sql.ErrNoRows) {
		fail(c, 404, "NOT_FOUND", "内容不存在")
	} else {
		fail(c, 503, "DATABASE_UNAVAILABLE", "数据库操作失败")
	}
}
func (a *API) auth(c *gin.Context) {
	c.Header("Cache-Control", "private, no-store")
	cookie, _ := c.Cookie("course_session")
	a.mu.Lock()
	s, ok := a.sessions[cookie]
	a.mu.Unlock()
	if !ok || time.Now().After(s.Expires) {
		fail(c, 401, "UNAUTHORIZED", "请登录")
		return
	}
	var role string
	err := a.db.QueryRow("SELECT role FROM users WHERE id=? AND disabled=FALSE", s.User).Scan(&role)
	if err != nil {
		fail(c, 401, "UNAUTHORIZED", "账号不可用")
		return
	}
	s.Role = role
	c.Set("session", s)
	if c.Request.Method != "GET" && c.GetHeader("X-CSRF-Token") != s.CSRF {
		fail(c, 403, "CSRF", "请求校验失败")
		return
	}
	c.Next()
}
func who(c *gin.Context) session { return c.MustGet("session").(session) }
func (a *API) access(c *gin.Context) bool {
	id := c.Param("id")
	if _, err := strconv.ParseUint(id, 10, 64); err != nil {
		fail(c, 400, "INVALID_ID", "无效课程 ID")
		return false
	}
	var owner string
	if err := a.db.QueryRow("SELECT owner_id FROM courses WHERE id=?", id).Scan(&owner); err != nil {
		a.databaseError(c, err)
		return false
	}
	s := who(c)
	if s.Role != "admin" && owner != s.User {
		fail(c, 404, "NOT_FOUND", "内容不存在")
		return false
	}
	return true
}
func (a *API) readJSON(c *gin.Context, v any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4<<20)
	d := json.NewDecoder(c.Request.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		fail(c, 400, "INVALID_JSON", "无效或过大的 JSON")
		return false
	}
	if d.Decode(new(any)) != io.EOF {
		fail(c, 400, "INVALID_JSON", "只允许一个 JSON 对象")
		return false
	}
	return true
}
func (a *API) body(c *gin.Context, raw json.RawMessage) (map[string]any, bool) {
	data, issues, err := a.checkedBody(c.Request.Context(), a.db, who(c), raw)
	if err != nil {
		a.databaseError(c, err)
		return nil, false
	}
	if len(issues) > 0 {
		c.AbortWithStatusJSON(422, gin.H{"error": gin.H{"code": "INVALID_COURSE", "message": "课程校验失败", "issues": issues}, "requestId": token()})
		return nil, false
	}
	return data, true
}
func (a *API) routes(r *gin.Engine) {
	r.POST("/api/v1/auth/login", func(c *gin.Context) {
		a.mu.Lock()
		l := a.limits[c.ClientIP()]
		if time.Now().After(l.Until) {
			l = loginLimit{Until: time.Now().Add(time.Minute)}
		}
		l.Count++
		a.limits[c.ClientIP()] = l
		a.mu.Unlock()
		if l.Count > 20 {
			fail(c, 429, "RATE_LIMIT", "请稍后登录")
			return
		}
		var in struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if !a.readJSON(c, &in) {
			return
		}
		var uid, hash, role string
		err := a.db.QueryRow("SELECT id,password_hash,role FROM users WHERE username=? AND disabled=FALSE", in.Username).Scan(&uid, &hash, &role)
		if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
			fail(c, 401, "INVALID_CREDENTIALS", "账号或密码错误")
			return
		}
		old, _ := c.Cookie("course_session")
		key := token()
		s := session{uid, role, token(), time.Now().Add(8 * time.Hour)}
		a.mu.Lock()
		delete(a.sessions, old)
		for k, v := range a.sessions {
			if time.Now().After(v.Expires) {
				delete(a.sessions, k)
			}
		}
		a.sessions[key] = s
		a.mu.Unlock()
		c.SetSameSite(http.SameSiteLaxMode)
		c.SetCookie("course_session", key, 28800, "/", "", a.secure, true)
		c.Header("Cache-Control", "no-store")
		c.JSON(200, gin.H{"id": uid, "role": role, "csrfToken": s.CSRF})
	})
	g := r.Group("/api/v1")
	g.Use(a.auth)
	a.versionRoutes(r, g)
	g.GET("/auth/me", func(c *gin.Context) {
		s := who(c)
		c.JSON(200, gin.H{"id": s.User, "role": s.Role, "csrfToken": s.CSRF})
	})
	g.POST("/auth/logout", func(c *gin.Context) {
		key, _ := c.Cookie("course_session")
		a.mu.Lock()
		delete(a.sessions, key)
		a.mu.Unlock()
		c.SetCookie("course_session", "", -1, "/", "", a.secure, true)
		c.Status(204)
	})
	g.GET("/courses", func(c *gin.Context) {
		s := who(c)
		after := c.DefaultQuery("after", "0")
		if _, err := strconv.ParseUint(after, 10, 64); err != nil {
			fail(c, 400, "INVALID_CURSOR", "无效游标")
			return
		}
		rows, err := a.db.Query("SELECT id,title,category FROM courses WHERE id>? AND (?='admin' OR owner_id=?) ORDER BY id LIMIT 50", after, s.Role, s.User)
		if err != nil {
			a.databaseError(c, err)
			return
		}
		defer rows.Close()
		list := []gin.H{}
		for rows.Next() {
			var id, title, category string
			if err = rows.Scan(&id, &title, &category); err != nil {
				a.databaseError(c, err)
				return
			}
			list = append(list, gin.H{"id": id, "title": title, "category": category})
		}
		if rows.Err() != nil {
			a.databaseError(c, rows.Err())
			return
		}
		c.JSON(200, gin.H{"courses": list})
	})
	g.POST("/courses", func(c *gin.Context) {
		var in struct {
			Body json.RawMessage `json:"body"`
		}
		if !a.readJSON(c, &in) {
			return
		}
		data, ok := a.body(c, in.Body)
		if !ok {
			return
		}
		tx, err := a.db.Begin()
		if err != nil {
			a.databaseError(c, err)
			return
		}
		defer tx.Rollback()
		s := who(c)
		res, err := tx.Exec("INSERT INTO courses(slug,title,summary,category,owner_id,operation_log) VALUES(?,?,?,?,?,'[]')", "course-"+token()[:32], data["title"], data["summary"], data["category"], s.User)
		if err != nil {
			a.databaseError(c, err)
			return
		}
		id, _ := res.LastInsertId()
		_, err = tx.Exec("INSERT INTO course_drafts(course_id,body,updated_by) VALUES(?,?,?)", id, []byte(in.Body), s.User)
		if err == nil {
			err = tx.Commit()
		}
		if err != nil {
			a.databaseError(c, err)
			return
		}
		c.JSON(201, gin.H{"id": strconv.FormatInt(id, 10), "revision": "1"})
	})
	get := func(c *gin.Context) {
		if !a.access(c) {
			return
		}
		var body json.RawMessage
		var revision string
		if err := a.db.QueryRow("SELECT body,revision FROM course_drafts WHERE course_id=?", c.Param("id")).Scan(&body, &revision); err != nil {
			a.databaseError(c, err)
			return
		}
		c.JSON(200, gin.H{"body": body, "revision": revision})
	}
	g.GET("/courses/:id/draft", get)
	g.GET("/courses/:id/preview", get)
	g.POST("/courses/:id/validate", func(c *gin.Context) {
		if !a.access(c) {
			return
		}
		var in struct {
			Body json.RawMessage `json:"body"`
		}
		if !a.readJSON(c, &in) {
			return
		}
		if _, ok := a.body(c, in.Body); ok {
			c.JSON(200, gin.H{"valid": true})
		}
	})
	g.PUT("/courses/:id/draft", func(c *gin.Context) {
		if !a.access(c) {
			return
		}
		var in struct {
			Revision string          `json:"revision"`
			Body     json.RawMessage `json:"body"`
		}
		if !a.readJSON(c, &in) {
			return
		}
		rev, err := strconv.ParseUint(in.Revision, 10, 64)
		if err != nil || rev == 0 || rev == ^uint64(0) {
			fail(c, 400, "INVALID_REVISION", "无效修订号")
			return
		}
		data, ok := a.body(c, in.Body)
		if !ok {
			return
		}
		tx, err := a.db.Begin()
		if err != nil {
			a.databaseError(c, err)
			return
		}
		defer tx.Rollback()
		res, err := tx.Exec("UPDATE course_drafts SET body=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP(3) WHERE course_id=? AND revision=?", []byte(in.Body), who(c).User, c.Param("id"), in.Revision)
		if err != nil {
			a.databaseError(c, err)
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			var current string
			err = tx.QueryRow("SELECT revision FROM course_drafts WHERE course_id=?", c.Param("id")).Scan(&current)
			if err != nil {
				a.databaseError(c, err)
				return
			}
			c.AbortWithStatusJSON(409, gin.H{"error": gin.H{"code": "REVISION_CONFLICT", "message": "草稿已被更新，本地修改已保留", "currentRevision": current}, "requestId": token()})
			return
		}
		_, err = tx.Exec("UPDATE courses SET title=?,summary=?,category=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?", data["title"], data["summary"], data["category"], c.Param("id"))
		if err == nil {
			err = tx.Commit()
		}
		if err != nil {
			a.databaseError(c, err)
			return
		}
		c.JSON(200, gin.H{"revision": strconv.FormatUint(rev+1, 10)})
	})
	g.POST("/assets", a.upload)
	g.GET("/assets/:id", a.asset)
}
func (a *API) upload(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, (10<<20)+65536)
	if err := c.Request.ParseMultipartForm(1 << 20); err != nil {
		fail(c, 413, "UPLOAD_LIMIT", "资源超过 10MB 或格式错误")
		return
	}
	if c.Request.MultipartForm != nil {
		defer c.Request.MultipartForm.RemoveAll()
	}
	f, h, err := c.Request.FormFile("file")
	if err != nil {
		fail(c, 400, "MISSING_FILE", "请选择文件")
		return
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, (10<<20)+1))
	if err != nil || len(b) > 10<<20 {
		fail(c, 413, "UPLOAD_LIMIT", "资源超过 10MB")
		return
	}
	mime := http.DetectContentType(b)
	if mime != "image/png" && mime != "image/jpeg" && mime != "image/webp" && mime != "application/pdf" {
		fail(c, 422, "UNSUPPORTED_MEDIA", "允许 PNG/JPEG/WebP/PDF；SVG 暂不接受")
		return
	}
	key := token()
	path := filepath.Join(a.dir, key)
	if err = os.WriteFile(path, b, 0600); err != nil {
		fail(c, 503, "STORAGE_UNAVAILABLE", "资源写入失败")
		return
	}
	hash := sha256.Sum256(b)
	name := filepath.Base(h.Filename)
	if len(name) > 255 {
		name = "upload"
	}
	res, err := a.db.Exec("INSERT INTO assets(storage_key,original_name,mime_type,byte_size,sha256,uploaded_by) VALUES(?,?,?,?,?,?)", key, name, mime, len(b), hex.EncodeToString(hash[:]), who(c).User)
	if err != nil {
		os.Remove(path)
		a.databaseError(c, err)
		return
	}
	id, _ := res.LastInsertId()
	c.JSON(201, gin.H{"id": fmt.Sprintf("asset-%d", id), "mimeType": mime, "byteSize": len(b)})
}
func (a *API) asset(c *gin.Context) {
	id := strings.TrimPrefix(c.Param("id"), "asset-")
	if _, err := strconv.ParseUint(id, 10, 64); err != nil {
		fail(c, 400, "INVALID_ID", "无效资源 ID")
		return
	}
	var key, mime, owner string
	if err := a.db.QueryRow("SELECT storage_key,mime_type,uploaded_by FROM assets WHERE id=?", id).Scan(&key, &mime, &owner); err != nil {
		a.databaseError(c, err)
		return
	}
	s := who(c)
	if s.Role != "admin" && s.User != owner {
		fail(c, 404, "NOT_FOUND", "资源不存在")
		return
	}
	a.serveAsset(c, key, mime)
}
func (a *API) serveAsset(c *gin.Context, key, mime string) {
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Security-Policy", "default-src 'none'; sandbox")
	if mime == "application/pdf" {
		c.Header("Content-Disposition", "attachment")
	}
	c.Header("Content-Type", mime)
	c.File(filepath.Join(a.dir, key))
}
func setupAPI(r *gin.Engine, db *sql.DB) error {
	schema, err := compileContract()
	if err != nil {
		return err
	}
	dir := os.Getenv("ASSET_DIR")
	if dir == "" {
		dir = "../.local/assets"
	}
	dir, err = filepath.Abs(dir)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	if name, pass := os.Getenv("BOOTSTRAP_ADMIN_USER"), os.Getenv("BOOTSTRAP_ADMIN_PASSWORD"); name != "" && pass != "" {
		if len(pass) < 12 {
			return fmt.Errorf("bootstrap password requires 12 characters")
		}
		hash, e := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
		if e != nil {
			return e
		}
		if _, e = db.Exec("INSERT INTO users(username,password_hash,role) VALUES(?,?,'admin') ON DUPLICATE KEY UPDATE username=username", name, string(hash)); e != nil {
			return e
		}
	}
	a := &API{db: db, schema: schema, dir: dir, secure: os.Getenv("COOKIE_SECURE") == "true", sessions: map[string]session{}, limits: map[string]loginLimit{}}
	a.routes(r)
	return nil
}
