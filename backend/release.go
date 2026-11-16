package main

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
)

type rowReader interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func positiveID(s string) bool {
	n, err := strconv.ParseUint(s, 10, 64)
	return err == nil && n > 0 && strconv.FormatUint(n, 10) == s
}

// Check the exact uploaded bytes before making a snapshot playable.
func (a *API) checkedBody(ctx context.Context, q rowReader, s session, raw json.RawMessage) (map[string]any, []validationIssue, error) {
	data, issues := validateBody(a.schema, raw)
	if len(issues) > 0 {
		return nil, issues, nil
	}
	for i, v := range arr(data["assets"]) {
		ref := str(obj(v)["id"])
		id := strings.TrimPrefix(ref, "asset-")
		issue := []validationIssue{{fmt.Sprintf("/assets/%d/id", i), "资源不存在、不可读取或无权使用"}}
		if id == ref || !positiveID(id) {
			return nil, issue, nil
		}
		var key, owner, digest string
		var size int64
		err := q.QueryRowContext(ctx, "SELECT storage_key,uploaded_by,byte_size,sha256 FROM assets WHERE id=?", id).Scan(&key, &owner, &size, &digest)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, issue, nil
		}
		if err != nil {
			return nil, nil, err
		}
		if s.Role != "admin" && s.User != owner {
			return nil, issue, nil
		}
		f, err := os.Open(filepath.Join(a.dir, key))
		if err != nil {
			return nil, issue, nil
		}
		h := sha256.New()
		n, err := io.Copy(h, io.LimitReader(f, size+1))
		f.Close()
		if err != nil || n != size || fmt.Sprintf("%x", h.Sum(nil)) != digest {
			return nil, issue, nil
		}
	}
	return data, nil, nil
}

type releaseInput struct {
	Revision  string `json:"revision,omitempty"`
	VersionID string `json:"versionId,omitempty"`
	Reason    string `json:"reason,omitempty"`
}
type operation struct {
	Key    string    `json:"operationId"`
	Kind   string    `json:"kind"`
	Actor  string    `json:"actorId"`
	At     time.Time `json:"at"`
	From   *string   `json:"fromVersionId"`
	To     string    `json:"toVersionId"`
	Reason string    `json:"reason"`
	Hash   string    `json:"requestHash"`
}
type releaseError struct {
	status        int
	code, message string
	issues        []validationIssue
}

func (e *releaseError) Error() string { return e.message }

var operationKey = regexp.MustCompile("^[a-z0-9_-]{1,64}$")

func (a *API) release(kind string) gin.HandlerFunc {
	return func(c *gin.Context) {
		actor := who(c)
		if actor.Role != "admin" {
			fail(c, 403, "FORBIDDEN", "需要管理员权限")
			return
		}
		var in releaseInput
		if !a.readJSON(c, &in) {
			return
		}
		key, id := c.GetHeader("Idempotency-Key"), c.Param("id")
		if !positiveID(id) || !operationKey.MatchString(key) {
			fail(c, 400, "INVALID_REQUEST", "课程编号或幂等键无效")
			return
		}
		in.Reason = strings.TrimSpace(in.Reason)
		if kind == "publish" && (!positiveID(in.Revision) || in.VersionID != "" || in.Reason != "") || kind == "rollback" && (!positiveID(in.VersionID) || in.Revision != "" || in.Reason == "" || len([]rune(in.Reason)) > 500) {
			fail(c, 400, "INVALID_REQUEST", "请指定已保存的修订，或选择历史版本并填写回滚原因（最多 500 字）")
			return
		}
		encoded, _ := json.Marshal(struct {
			CourseID string `json:"courseId"`
			releaseInput
		}{id, in})
		op := operation{Key: key, Kind: kind, Actor: actor.User, Reason: in.Reason, Hash: fmt.Sprintf("%x", sha256.Sum256(encoded))}
		var result string
		var err error
		for attempt := 0; attempt < 3; attempt++ {
			result, err = a.transactRelease(c.Request.Context(), id, in, actor, op)
			var dbErr *mysql.MySQLError
			if !errors.As(err, &dbErr) || dbErr.Number != 1213 {
				break
			}
		}
		if err != nil {
			var problem *releaseError
			if errors.As(err, &problem) {
				c.JSON(problem.status, gin.H{"error": gin.H{"code": problem.code, "message": problem.message, "issues": problem.issues}, "requestId": token()})
				return
			}
			a.databaseError(c, err)
			return
		}
		c.JSON(200, gin.H{"versionId": result})
	}
}
func (a *API) transactRelease(ctx context.Context, id string, in releaseInput, actor session, op operation) (string, error) {
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	var logJSON []byte
	err = tx.QueryRowContext(ctx, "SELECT published_version_id,operation_log FROM courses WHERE id=? FOR UPDATE", id).Scan(&op.From, &logJSON)
	if err != nil {
		return "", err
	}
	var history []operation
	if err = json.Unmarshal(logJSON, &history); err != nil {
		return "", err
	}
	for _, entry := range history {
		if entry.Key != op.Key {
			continue
		}
		if entry.Hash != op.Hash || entry.Kind != op.Kind {
			return "", &releaseError{409, "KEY_CONFLICT", "此幂等键已用于其他请求", nil}
		}
		return entry.To, nil
	}
	var raw json.RawMessage
	if op.Kind == "publish" {
		var revision string
		err = tx.QueryRowContext(ctx, "SELECT revision,body FROM course_drafts WHERE course_id=? FOR UPDATE", id).Scan(&revision, &raw)
		if err == nil && in.Revision != revision {
			return "", &releaseError{409, "REVISION_CONFLICT", "修订已更新，请重新打开草稿", nil}
		}
	} else {
		op.To = in.VersionID
		err = tx.QueryRowContext(ctx, "SELECT body FROM course_versions WHERE course_id=? AND id=?", id, op.To).Scan(&raw)
	}
	if err != nil {
		return "", err
	}
	data, issues, err := a.checkedBody(ctx, tx, actor, raw)
	if err != nil {
		return "", err
	}
	if len(issues) > 0 {
		return "", &releaseError{422, "INVALID_COURSE", "课程校验失败", issues}
	}
	if op.Kind == "publish" {
		refs := []string{}
		for _, v := range arr(data["assets"]) {
			refs = append(refs, str(obj(v)["id"]))
		}
		assets, _ := json.Marshal(refs)
		var number uint64
		if err = tx.QueryRowContext(ctx, "SELECT COALESCE(MAX(version_no),0)+1 FROM course_versions WHERE course_id=?", id).Scan(&number); err != nil {
			return "", err
		}
		res, err := tx.ExecContext(ctx, "INSERT INTO course_versions(course_id,version_no,draft_revision,body,asset_refs,request_key,request_hash,published_by) VALUES(?,?,?,?,?,?,?,?)", id, number, in.Revision, []byte(raw), assets, op.Key, op.Hash, actor.User)
		if err != nil {
			return "", err
		}
		vid, err := res.LastInsertId()
		if err != nil {
			return "", err
		}
		op.To = strconv.FormatInt(vid, 10)
		for _, v := range arr(data["components"]) {
			comp := obj(v)
			if _, err = tx.ExecContext(ctx, "INSERT INTO course_component_refs(version_id,component_type,component_version) VALUES(?,?,?)", vid, comp["type"], comp["version"]); err != nil {
				return "", err
			}
		}
	}
	op.At = time.Now().UTC()
	entry, _ := json.Marshal(op)
	if len(logJSON)+len(entry)+2 > 1<<20 {
		log.Printf("course %s operation log reached size limit", id)
		return "", &releaseError{409, "AUDIT_LIMIT", "审计记录已达容量上限，请联系维护人员", nil}
	}
	_, err = tx.ExecContext(ctx, "UPDATE courses SET published_version_id=?, status='published', operation_log=JSON_ARRAY_APPEND(operation_log,'$',CAST(? AS JSON)) WHERE id=?", op.To, entry, id)
	if err != nil {
		return "", err
	}
	return op.To, tx.Commit()
}
