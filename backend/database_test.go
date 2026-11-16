package main

import (
	"database/sql"
	_ "github.com/go-sql-driver/mysql"
	"os"
	"testing"
)

func TestDatabase(t *testing.T) {
	dsn := os.Getenv("MYSQL_DSN")
	if dsn == "" {
		t.Skip("set MYSQL_DSN for actual MySQL integration check")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var version string
	if err = db.QueryRow("SELECT VERSION()").Scan(&version); err != nil {
		t.Fatal(err)
	}
	t.Log("MySQL", version)
	var count int
	if err = db.QueryRow("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('users','courses','course_drafts','course_versions','assets','course_component_refs') AND engine='InnoDB'").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 6 {
		t.Fatalf("want six InnoDB business tables, got %d", count)
	}
	if err = db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE version='001_initial'").Scan(&count); err != nil || count != 1 {
		t.Fatalf("migration marker: %d %v", count, err)
	}
}
