ALTER TABLE courses DROP FOREIGN KEY fk_current_version;
DROP TABLE course_component_refs;
DROP TABLE assets;
DROP TABLE course_versions;
DROP TABLE course_drafts;
DROP TABLE courses;
DROP TABLE users;
DELETE FROM schema_migrations WHERE version='001_initial';
