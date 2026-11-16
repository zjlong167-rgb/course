package main

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"strings"
)

const currentSnapshot = " FROM courses c JOIN course_versions v ON v.id=c.published_version_id AND v.course_id=c.id WHERE c.status='published'"

func (a *API) versionRoutes(r *gin.Engine, g *gin.RouterGroup) {
	g.POST("/courses/:id/publish", a.release("publish"))
	g.POST("/courses/:id/rollback", a.release("rollback"))
	g.GET("/courses/:id/versions", a.history)
	g.GET("/courses/:id/versions/:version", func(c *gin.Context) {
		if !a.access(c) {
			return
		}
		var body json.RawMessage
		if !positiveID(c.Param("version")) {
			fail(c, 400, "INVALID_ID", "版本编号无效")
			return
		}
		err := a.db.QueryRow("SELECT body FROM course_versions WHERE course_id=? AND id=?", c.Param("id"), c.Param("version")).Scan(&body)
		if err != nil {
			a.databaseError(c, err)
			return
		}
		c.JSON(200, gin.H{"body": body, "versionId": c.Param("version")})
	})
	g.GET("/courses/:id/versions/:version/assets/:asset", func(c *gin.Context) {
		if !a.access(c) {
			return
		}
		a.versionAsset(c, false)
	})
	pub := r.Group("/api/v1/public")
	pub.Use(func(c *gin.Context) { c.Header("Cache-Control", "no-cache"); c.Next() })
	pub.GET("/courses", func(c *gin.Context) {
		rows, err := a.db.Query("SELECT c.slug,v.id,v.body->>'$.title',v.body->>'$.summary',v.body->>'$.category'" + currentSnapshot + " ORDER BY c.id")
		if err != nil {
			a.databaseError(c, err)
			return
		}
		defer rows.Close()
		list := []gin.H{}
		for rows.Next() {
			var slug, vid, title, summary, cat string
			if err = rows.Scan(&slug, &vid, &title, &summary, &cat); err != nil {
				a.databaseError(c, err)
				return
			}
			list = append(list, gin.H{"slug": slug, "versionId": vid, "title": title, "summary": summary, "category": cat})
		}
		if rows.Err() != nil {
			a.databaseError(c, rows.Err())
			return
		}
		c.JSON(200, gin.H{"courses": list})
	})
	pub.GET("/courses/:slug", func(c *gin.Context) {
		var vid string
		var body json.RawMessage
		err := a.db.QueryRow("SELECT v.id,v.body"+currentSnapshot+" AND c.slug=?", c.Param("slug")).Scan(&vid, &body)
		if err != nil {
			a.databaseError(c, err)
			return
		}
		tag := "\"" + vid + "\""
		c.Header("ETag", tag)
		for _, item := range strings.Split(c.GetHeader("If-None-Match"), ",") {
			item = strings.TrimSpace(item)
			if item == "*" || strings.TrimPrefix(item, "W/") == tag {
				c.Status(304)
				return
			}
		}
		c.JSON(200, gin.H{"versionId": vid, "body": body})
	})
	pub.GET("/courses/:slug/versions/:version/assets/:asset", func(c *gin.Context) { a.versionAsset(c, true) })
}
func (a *API) versionAsset(c *gin.Context, public bool) {
	c.Header("Cache-Control", "private, no-store")
	ref, version := c.Param("asset"), c.Param("version")
	id := strings.TrimPrefix(ref, "asset-")
	if id == ref || !positiveID(id) || !positiveID(version) {
		fail(c, 404, "NOT_FOUND", "资源不存在")
		return
	}
	query := "SELECT a.storage_key,a.mime_type FROM course_versions v JOIN courses c ON c.id=v.course_id JOIN assets a ON a.id=? WHERE v.id=? AND JSON_CONTAINS(v.asset_refs, JSON_QUOTE(?))"
	var course string
	if public {
		query += " AND c.slug=? AND c.published_version_id=v.id AND c.status='published'"
		course = c.Param("slug")
	} else {
		query += " AND c.id=?"
		course = c.Param("id")
	}
	var key, mime string
	if err := a.db.QueryRow(query, id, version, ref, course).Scan(&key, &mime); err != nil {
		a.databaseError(c, err)
		return
	}
	a.serveAsset(c, key, mime)
}

func (a *API) history(c *gin.Context) {
	if !a.access(c) {
		return
	}
	tx, err := a.db.Begin()
	if err != nil {
		a.databaseError(c, err)
		return
	}
	defer tx.Rollback()
	var slug string
	var current *string
	var history json.RawMessage
	err = tx.QueryRow("SELECT slug,published_version_id,operation_log FROM courses WHERE id=?", c.Param("id")).Scan(&slug, &current, &history)
	if err != nil {
		a.databaseError(c, err)
		return
	}
	rows, err := tx.Query("SELECT id,version_no,draft_revision,published_by,published_at FROM course_versions WHERE course_id=? ORDER BY version_no DESC", c.Param("id"))
	if err != nil {
		a.databaseError(c, err)
		return
	}
	defer rows.Close()
	list := []gin.H{}
	for rows.Next() {
		var id, num, revision, actor, at string
		if err = rows.Scan(&id, &num, &revision, &actor, &at); err != nil {
			a.databaseError(c, err)
			return
		}
		list = append(list, gin.H{"versionId": id, "versionNo": num, "revision": revision, "publishedBy": actor, "publishedAt": at})
	}
	if rows.Err() != nil {
		a.databaseError(c, rows.Err())
		return
	}
	c.JSON(200, gin.H{"versions": list, "currentVersionId": current, "operations": history, "slug": slug})
}
