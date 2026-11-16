// Versioned S01 migration runner; intentionally no GORM AutoMigrate.
package main

import (
	"database/sql"
	"fmt"
	_ "github.com/go-sql-driver/mysql"
	"log"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	dsn := os.Getenv("MYSQL_DSN")
	if dsn == "" {
		log.Fatal("MYSQL_DSN required")
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	conn, err := db.Conn(nilContext())
	if err != nil {
		log.Fatal(err)
	}
	defer conn.Close()
	var locked int
	if err = conn.QueryRowContext(nilContext(), "SELECT GET_LOCK('course_schema_migrate', 10)").Scan(&locked); err != nil || locked != 1 {
		log.Fatal("migration lock unavailable", err)
	}
	defer conn.ExecContext(nilContext(), "SELECT RELEASE_LOCK('course_schema_migrate')")
	if _, err = conn.ExecContext(nilContext(), "CREATE TABLE IF NOT EXISTS schema_migrations(version VARCHAR(64) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))"); err != nil {
		log.Fatal(err)
	}
	files, err := filepath.Glob("migrations/*.up.sql")
	if err != nil {
		log.Fatal(err)
	}
	for _, file := range files {
		version := strings.TrimSuffix(filepath.Base(file), ".up.sql")
		var count int
		if err = conn.QueryRowContext(nilContext(), "SELECT COUNT(*) FROM schema_migrations WHERE version=?", version).Scan(&count); err != nil {
			log.Fatal(err)
		}
		if count > 0 {
			fmt.Println(version, "already applied")
			continue
		}
		b, err := os.ReadFile(file)
		if err != nil {
			log.Fatal(err)
		}
		for _, statement := range strings.Split(string(b), ";") {
			if strings.TrimSpace(statement) == "" {
				continue
			}
			if _, err = conn.ExecContext(nilContext(), statement); err != nil {
				log.Fatal("nontransactional DDL failed; inspect partial migration: ", err)
			}
		}
		if _, err = conn.ExecContext(nilContext(), "INSERT INTO schema_migrations(version) VALUES(?)", version); err != nil {
			log.Fatal(err)
		}
		fmt.Println(version, "applied")
	}
}
