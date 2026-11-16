CREATE TABLE users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(64) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('admin','author') NOT NULL,
 disabled BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE courses (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 slug VARCHAR(64) NOT NULL UNIQUE,
 title VARCHAR(255) NOT NULL,
 summary TEXT NOT NULL,
 category ENUM('network','business','math','manufacturing') NOT NULL,
 status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
 owner_id BIGINT UNSIGNED NOT NULL,
 published_version_id BIGINT UNSIGNED NULL,
 operation_log JSON NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(owner_id) REFERENCES users(id),
 INDEX idx_catalog(status,category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE course_drafts (
 course_id BIGINT UNSIGNED PRIMARY KEY,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
 body JSON NOT NULL,
 updated_by BIGINT UNSIGNED NOT NULL,
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(course_id) REFERENCES courses(id),
 FOREIGN KEY(updated_by) REFERENCES users(id),
 CHECK(revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE course_versions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 course_id BIGINT UNSIGNED NOT NULL,
 version_no BIGINT UNSIGNED NOT NULL,
 draft_revision BIGINT UNSIGNED NOT NULL,
 body JSON NOT NULL,
 asset_refs JSON NOT NULL,
 request_key VARCHAR(64) NOT NULL,
 request_hash CHAR(64) NOT NULL,
 published_by BIGINT UNSIGNED NOT NULL,
 published_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 UNIQUE KEY uq_course_version(course_id,version_no),
 UNIQUE KEY uq_publish_retry(course_id,request_key),
 UNIQUE KEY uq_version_course(id,course_id),
 FOREIGN KEY(course_id) REFERENCES courses(id),
 FOREIGN KEY(published_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE courses ADD CONSTRAINT fk_current_version FOREIGN KEY(published_version_id,id) REFERENCES course_versions(id,course_id);
CREATE TABLE assets (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 storage_key VARCHAR(255) NOT NULL UNIQUE,
 original_name VARCHAR(255) NOT NULL,
 mime_type VARCHAR(128) NOT NULL,
 byte_size BIGINT UNSIGNED NOT NULL,
 sha256 CHAR(64) NOT NULL,
 uploaded_by BIGINT UNSIGNED NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY(uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE course_component_refs (
 version_id BIGINT UNSIGNED NOT NULL,
 component_type VARCHAR(64) NOT NULL,
 component_version VARCHAR(32) NOT NULL,
 PRIMARY KEY(version_id,component_type),
 FOREIGN KEY(version_id) REFERENCES course_versions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
