#![allow(dead_code)]
use rusqlite::{params, params_from_iter, Connection};
use std::path::Path;
use std::sync::Mutex;
use uuid::Uuid;

use crate::models::{AxisFacetItem, Playlist, SmartFolder, UrlEntry, Work, WorkSummary};

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self, String> {
        let conn =
            Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        let db = Database {
            conn: Mutex::new(conn),
        };
        db.initialize()?;
        Ok(db)
    }

    fn initialize(&self) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;

        conn.execute_batch(
            "
            PRAGMA journal_mode=WAL;
            PRAGMA foreign_keys=ON;
        ",
        )
        .map_err(|e| format!("Failed to set pragmas: {}", e))?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS works (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                cover_image TEXT,
                default_playlist TEXT,
                created_at TEXT,
                status TEXT NOT NULL DEFAULT 'normal',
                physical_path TEXT NOT NULL,
                total_duration_sec INTEGER NOT NULL DEFAULT 0,
                added_at TEXT NOT NULL DEFAULT (datetime('now')),
                error_message TEXT,
                urls_json TEXT NOT NULL DEFAULT '[]',
                playlists_json TEXT NOT NULL DEFAULT '[]',
                bookmarked INTEGER NOT NULL DEFAULT 0,
                last_played_at TEXT,
                resume_position REAL NOT NULL DEFAULT 0,
                resume_track_index INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS work_tags (
                work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
                tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                PRIMARY KEY (work_id, tag_id)
            );

            CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);
            CREATE INDEX IF NOT EXISTS idx_works_title ON works(title);
            CREATE INDEX IF NOT EXISTS idx_works_added_at ON works(added_at);
            CREATE INDEX IF NOT EXISTS idx_works_physical_path ON works(physical_path);
            CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
            CREATE INDEX IF NOT EXISTS idx_work_tags_work_id ON work_tags(work_id);
            CREATE INDEX IF NOT EXISTS idx_work_tags_tag_id ON work_tags(tag_id);

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS search_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                query TEXT NOT NULL DEFAULT '',
                tag_filters_json TEXT NOT NULL DEFAULT '[]',
                sort_id TEXT NOT NULL DEFAULT 'added-desc',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS smart_folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                rules_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        ",
        )
        .map_err(|e| format!("Failed to create tables: {}", e))?;

        // Migrate existing databases: add new columns if they don't exist
        let _ = conn.execute_batch(
            "
            ALTER TABLE works ADD COLUMN bookmarked INTEGER NOT NULL DEFAULT 0;
            ALTER TABLE works ADD COLUMN last_played_at TEXT;
            ALTER TABLE works ADD COLUMN resume_position REAL NOT NULL DEFAULT 0;
            ALTER TABLE works ADD COLUMN resume_track_index INTEGER NOT NULL DEFAULT 0;
        ",
        );

        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let mut stmt = conn
            .prepare("SELECT value FROM app_settings WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        let result = stmt.query_row(params![key], |row| row.get(0)).ok();
        Ok(result)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn upsert_work(&self, work: &Work) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let urls_json = serde_json::to_string(&work.urls)
            .map_err(|e| format!("Failed to serialize urls: {}", e))?;
        let playlists_json = serde_json::to_string(&work.playlists)
            .map_err(|e| format!("Failed to serialize playlists: {}", e))?;

        conn.execute(
            "INSERT OR REPLACE INTO works (id, title, cover_image, default_playlist, created_at, status, physical_path, total_duration_sec, added_at, error_message, urls_json, playlists_json, bookmarked, last_played_at, resume_position, resume_track_index)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                work.id,
                work.title,
                work.cover_image,
                work.default_playlist,
                work.created_at,
                work.status,
                work.physical_path,
                work.total_duration_sec,
                work.added_at,
                work.error_message,
                urls_json,
                playlists_json,
                work.bookmarked,
                work.last_played_at,
                work.resume_position,
                work.resume_track_index,
            ],
        )
        .map_err(|e| format!("Failed to upsert work: {}", e))?;

        // Update tags
        conn.execute("DELETE FROM work_tags WHERE work_id = ?1", params![work.id])
            .map_err(|e| e.to_string())?;

        for tag in &work.tags {
            conn.execute(
                "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
                params![tag],
            )
            .map_err(|e| e.to_string())?;

            conn.execute(
                "INSERT OR IGNORE INTO work_tags (work_id, tag_id)
                 SELECT ?1, id FROM tags WHERE name = ?2",
                params![work.id, tag],
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    fn axis_tag_name(axis: &str, axis_value: &str) -> Option<String> {
        if axis_value.trim().is_empty() {
            return None;
        }

        match axis {
            "circle" => Some(format!("サークル/{}", axis_value)),
            "cv" => Some(format!("cv/{}", axis_value)),
            "series" => Some(format!("シリーズ/{}", axis_value)),
            "cat" => Some(format!("カテゴリ/{}", axis_value)),
            "tag" => Some(axis_value.to_string()),
            _ => None,
        }
    }

    fn work_order_clause(sort: Option<&str>, view: Option<&str>) -> &'static str {
        let sort_id = sort.map(str::trim).filter(|s| !s.is_empty());
        if sort_id.is_none() && view == Some("recent") {
            return "w.last_played_at DESC, w.added_at DESC";
        }

        match sort_id.unwrap_or("added-desc") {
            "added-asc" => "w.added_at ASC, w.title COLLATE NOCASE ASC",
            "title-asc" => "w.title COLLATE NOCASE ASC, w.added_at DESC",
            "title-desc" => "w.title COLLATE NOCASE DESC, w.added_at DESC",
            "duration-desc" => "w.total_duration_sec DESC, w.added_at DESC",
            "duration-asc" => "w.total_duration_sec ASC, w.added_at DESC",
            "last-played" => "w.last_played_at IS NULL ASC, w.last_played_at DESC, w.added_at DESC",
            _ => "w.added_at DESC, w.title COLLATE NOCASE ASC",
        }
    }

    fn query_work_summaries(
        &self,
        query: Option<&str>,
        tag_filters: &[String],
        axis: Option<&str>,
        axis_value: Option<&str>,
        tag_op: Option<&str>,
        sort: Option<&str>,
        view: Option<&str>,
    ) -> Result<Vec<WorkSummary>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let mut where_clauses: Vec<String> = Vec::new();
        let mut bindings: Vec<String> = Vec::new();

        if let Some(q) = query.map(str::trim).filter(|q| !q.is_empty()) {
            where_clauses.push(
                "(LOWER(w.title) LIKE ? OR EXISTS (
                    SELECT 1 FROM work_tags wt
                    JOIN tags t ON wt.tag_id = t.id
                    WHERE wt.work_id = w.id AND LOWER(t.name) LIKE ?
                ))"
                .to_string(),
            );
            let pattern = format!("%{}%", q.to_lowercase());
            bindings.push(pattern.clone());
            bindings.push(pattern);
        }

        let tag_filters: Vec<&String> = tag_filters
            .iter()
            .filter(|tag| !tag.trim().is_empty())
            .collect();
        if !tag_filters.is_empty() {
            let is_or = tag_op
                .map(|op| op.eq_ignore_ascii_case("OR"))
                .unwrap_or(false);
            if is_or {
                let filters = tag_filters
                    .iter()
                    .map(|_| "LOWER(t.name) LIKE ?")
                    .collect::<Vec<_>>()
                    .join(" OR ");
                where_clauses.push(format!(
                    "EXISTS (
                        SELECT 1 FROM work_tags wt
                        JOIN tags t ON wt.tag_id = t.id
                        WHERE wt.work_id = w.id AND ({})
                    )",
                    filters
                ));
                for tag in tag_filters {
                    bindings.push(format!("%{}%", tag.to_lowercase()));
                }
            } else {
                for tag in tag_filters {
                    where_clauses.push(
                        "EXISTS (
                            SELECT 1 FROM work_tags wt
                            JOIN tags t ON wt.tag_id = t.id
                            WHERE wt.work_id = w.id AND LOWER(t.name) LIKE ?
                        )"
                        .to_string(),
                    );
                    bindings.push(format!("%{}%", tag.to_lowercase()));
                }
            }
        }

        if let (Some(axis), Some(axis_value)) = (axis, axis_value) {
            if let Some(tag_name) = Self::axis_tag_name(axis, axis_value) {
                where_clauses.push(
                    "EXISTS (
                        SELECT 1 FROM work_tags wt
                        JOIN tags t ON wt.tag_id = t.id
                        WHERE wt.work_id = w.id AND t.name = ?
                    )"
                    .to_string(),
                );
                bindings.push(tag_name);
            }
        }

        match view {
            Some("recent") => where_clauses.push("w.last_played_at IS NOT NULL".to_string()),
            Some("added") => {
                where_clauses.push("w.added_at >= datetime('now', '-30 days')".to_string())
            }
            Some("fav") => where_clauses.push("w.bookmarked = 1".to_string()),
            Some("unplayed") => {
                where_clauses.push("w.last_played_at IS NULL AND w.status = 'normal'".to_string())
            }
            Some("missing") => where_clauses.push("w.status = 'missing'".to_string()),
            _ => {}
        }

        let where_sql = if where_clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", where_clauses.join(" AND "))
        };

        let sql = format!(
            "SELECT w.id, w.title, w.cover_image, w.status, w.physical_path,
                    w.total_duration_sec, w.added_at, w.error_message, w.urls_json, w.playlists_json,
                    w.bookmarked, w.last_played_at
             FROM works w
             {}
             ORDER BY {}",
            where_sql,
            Self::work_order_clause(sort, view)
        );

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let works: Vec<WorkSummary> = stmt
            .query_map(params_from_iter(bindings.iter()), |row| {
                let id: String = row.get(0)?;
                let urls_json: String = row.get(8)?;
                let playlists_json: String = row.get(9)?;
                let urls: Vec<UrlEntry> = serde_json::from_str(&urls_json).unwrap_or_default();
                let playlists: Vec<Playlist> =
                    serde_json::from_str(&playlists_json).unwrap_or_default();
                let track_count = playlists.first().map(|p| p.tracks.len()).unwrap_or(0);
                let bookmarked_int: i32 = row.get(10)?;

                Ok(WorkSummary {
                    id,
                    title: row.get(1)?,
                    cover_image: row.get(2)?,
                    status: row.get(3)?,
                    physical_path: row.get(4)?,
                    total_duration_sec: row.get(5)?,
                    added_at: row.get(6)?,
                    error_message: row.get(7)?,
                    urls,
                    tags: Vec::new(), // filled below
                    track_count,
                    bookmarked: bookmarked_int != 0,
                    last_played_at: row.get(11)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        // Fill tags for each work
        let mut tag_stmt = conn
            .prepare("SELECT t.name FROM work_tags wt JOIN tags t ON wt.tag_id = t.id WHERE wt.work_id = ?1")
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for mut work in works {
            let tags: Vec<String> = tag_stmt
                .query_map(params![work.id], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            work.tags = tags;
            result.push(work);
        }

        Ok(result)
    }

    pub fn get_all_works(&self) -> Result<Vec<WorkSummary>, String> {
        self.query_work_summaries(None, &[], None, None, None, None, None)
    }

    pub fn get_all_works_filtered(
        &self,
        axis: Option<&str>,
        axis_value: Option<&str>,
        sort: Option<&str>,
        view: Option<&str>,
    ) -> Result<Vec<WorkSummary>, String> {
        self.query_work_summaries(None, &[], axis, axis_value, None, sort, view)
    }

    pub fn get_work(&self, id: &str) -> Result<Option<Work>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, cover_image, default_playlist, created_at, status,
                        physical_path, total_duration_sec, added_at, error_message,
                        urls_json, playlists_json, bookmarked, last_played_at,
                        resume_position, resume_track_index
                 FROM works WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;

        let work = stmt
            .query_row(params![id], |row| {
                let urls_json: String = row.get(10)?;
                let playlists_json: String = row.get(11)?;
                let bookmarked_int: i32 = row.get(12)?;

                Ok(Work {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    cover_image: row.get(2)?,
                    default_playlist: row.get(3)?,
                    created_at: row.get(4)?,
                    status: row.get(5)?,
                    physical_path: row.get(6)?,
                    total_duration_sec: row.get(7)?,
                    added_at: row.get(8)?,
                    error_message: row.get(9)?,
                    urls: serde_json::from_str(&urls_json).unwrap_or_default(),
                    tags: Vec::new(),
                    playlists: serde_json::from_str(&playlists_json).unwrap_or_default(),
                    bookmarked: bookmarked_int != 0,
                    last_played_at: row.get(13)?,
                    resume_position: row.get(14)?,
                    resume_track_index: row.get(15)?,
                })
            })
            .ok();

        if let Some(mut w) = work {
            let mut tag_stmt = conn
                .prepare("SELECT t.name FROM work_tags wt JOIN tags t ON wt.tag_id = t.id WHERE wt.work_id = ?1")
                .map_err(|e| e.to_string())?;
            let tags: Vec<String> = tag_stmt
                .query_map(params![w.id], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            w.tags = tags;
            Ok(Some(w))
        } else {
            Ok(None)
        }
    }

    pub fn search_works(
        &self,
        query: &str,
        tag_filters: &[String],
    ) -> Result<Vec<WorkSummary>, String> {
        self.query_work_summaries(Some(query), tag_filters, None, None, None, None, None)
    }

    pub fn search_works_filtered(
        &self,
        query: &str,
        tag_filters: &[String],
        axis: Option<&str>,
        axis_value: Option<&str>,
        tag_op: Option<&str>,
        sort: Option<&str>,
        view: Option<&str>,
    ) -> Result<Vec<WorkSummary>, String> {
        self.query_work_summaries(
            Some(query),
            tag_filters,
            axis,
            axis_value,
            tag_op,
            sort,
            view,
        )
    }

    pub fn mark_all_missing(&self) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute(
            "UPDATE works SET status = 'missing' WHERE status = 'normal'",
            [],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn mark_found(&self, id: &str) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute(
            "UPDATE works SET status = 'normal' WHERE id = ?1",
            params![id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_work(&self, id: &str) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute("DELETE FROM works WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_work_tags(&self, work_id: &str, tags: &[String]) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute("DELETE FROM work_tags WHERE work_id = ?1", params![work_id])
            .map_err(|e| e.to_string())?;

        for tag in tags {
            conn.execute(
                "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
                params![tag],
            )
            .map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT OR IGNORE INTO work_tags (work_id, tag_id) SELECT ?1, id FROM tags WHERE name = ?2",
                params![work_id, tag],
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn get_all_tags(&self) -> Result<Vec<String>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let mut stmt = conn
            .prepare("SELECT DISTINCT t.name FROM tags t JOIN work_tags wt ON t.id = wt.tag_id ORDER BY t.name")
            .map_err(|e| e.to_string())?;
        let tags: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(tags)
    }

    pub fn toggle_bookmark(&self, work_id: &str) -> Result<bool, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute(
            "UPDATE works SET bookmarked = CASE WHEN bookmarked = 0 THEN 1 ELSE 0 END WHERE id = ?1",
            params![work_id],
        ).map_err(|e| e.to_string())?;
        let bookmarked: bool = conn
            .query_row(
                "SELECT bookmarked FROM works WHERE id = ?1",
                params![work_id],
                |row| {
                    let v: i32 = row.get(0)?;
                    Ok(v != 0)
                },
            )
            .map_err(|e| e.to_string())?;
        Ok(bookmarked)
    }

    pub fn update_last_played(&self, work_id: &str) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        conn.execute(
            "UPDATE works SET last_played_at = ?1 WHERE id = ?2",
            params![now, work_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_resume_position(
        &self,
        work_id: &str,
        position: f64,
        track_index: i32,
    ) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute(
            "UPDATE works SET resume_position = ?1, resume_track_index = ?2 WHERE id = ?3",
            params![position, track_index, work_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    // Search presets
    pub fn save_search_preset(
        &self,
        name: &str,
        query: &str,
        tag_filters: &[String],
        sort_id: &str,
    ) -> Result<i64, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let tag_filters_json = serde_json::to_string(tag_filters)
            .map_err(|e| format!("Failed to serialize tag_filters: {}", e))?;
        conn.execute(
            "INSERT INTO search_presets (name, query, tag_filters_json, sort_id) VALUES (?1, ?2, ?3, ?4)",
            params![name, query, tag_filters_json, sort_id],
        ).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_search_presets(&self) -> Result<Vec<crate::models::SearchPreset>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, name, query, tag_filters_json, sort_id FROM search_presets ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let presets = stmt
            .query_map([], |row| {
                let tag_filters_json: String = row.get(3)?;
                Ok(crate::models::SearchPreset {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    query: row.get(2)?,
                    tag_filters: serde_json::from_str(&tag_filters_json).unwrap_or_default(),
                    sort_id: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(presets)
    }

    pub fn delete_search_preset(&self, id: i64) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute("DELETE FROM search_presets WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn find_work_by_id_any_path(&self, id: &str) -> Result<Option<String>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let mut stmt = conn
            .prepare("SELECT physical_path FROM works WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let result = stmt.query_row(params![id], |row| row.get(0)).ok();
        Ok(result)
    }

    pub fn update_work_path(&self, work_id: &str, new_path: &str) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute(
            "UPDATE works SET physical_path = ?1 WHERE id = ?2",
            params![new_path, work_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn work_exists_by_path(&self, path: &str) -> Result<Option<String>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let mut stmt = conn
            .prepare("SELECT id FROM works WHERE physical_path = ?1")
            .map_err(|e| e.to_string())?;
        let result = stmt.query_row(params![path], |row| row.get(0)).ok();
        Ok(result)
    }

    pub fn get_axis_facets(&self, axis: &str) -> Result<Vec<AxisFacetItem>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;

        if axis == "year" {
            let mut stmt = conn
                .prepare(
                    "SELECT substr(added_at, 1, 4) AS value, COUNT(*) AS count
                     FROM works
                     WHERE added_at IS NOT NULL AND added_at != '' AND substr(added_at, 1, 4) != ''
                     GROUP BY value
                     ORDER BY count DESC, value DESC",
                )
                .map_err(|e| e.to_string())?;
            let facets = stmt
                .query_map([], |row| {
                    Ok(AxisFacetItem {
                        value: row.get(0)?,
                        count: row.get(1)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            return Ok(facets);
        }

        if axis == "tag" {
            let mut stmt = conn
                .prepare(
                    "SELECT t.name AS value, COUNT(DISTINCT wt.work_id) AS count
                     FROM tags t
                     JOIN work_tags wt ON wt.tag_id = t.id
                     WHERE instr(t.name, '/') = 0
                     GROUP BY t.name
                     ORDER BY count DESC, value COLLATE NOCASE ASC",
                )
                .map_err(|e| e.to_string())?;
            let facets = stmt
                .query_map([], |row| {
                    Ok(AxisFacetItem {
                        value: row.get(0)?,
                        count: row.get(1)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            return Ok(facets);
        }

        let prefix = match axis {
            "circle" => "サークル/",
            "cv" => "cv/",
            "series" => "シリーズ/",
            "cat" => "カテゴリ/",
            _ => return Err(format!("Invalid axis: {}", axis)),
        };
        let value_start = prefix.chars().count() as i64 + 1;
        let like_pattern = format!("{}%", prefix);
        let mut stmt = conn
            .prepare(
                "SELECT substr(t.name, ?1) AS value, COUNT(DISTINCT wt.work_id) AS count
                 FROM tags t
                 JOIN work_tags wt ON wt.tag_id = t.id
                 WHERE t.name LIKE ?2 AND substr(t.name, ?1) != ''
                 GROUP BY value
                 ORDER BY count DESC, value COLLATE NOCASE ASC",
            )
            .map_err(|e| e.to_string())?;
        let facets = stmt
            .query_map(params![value_start, like_pattern], |row| {
                Ok(AxisFacetItem {
                    value: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(facets)
    }

    pub fn list_smart_folders(&self) -> Result<Vec<SmartFolder>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, name, rules_json, created_at, updated_at
                 FROM smart_folders
                 ORDER BY name COLLATE NOCASE ASC",
            )
            .map_err(|e| e.to_string())?;
        let folders = stmt
            .query_map([], |row| {
                let rules_json: String = row.get(2)?;
                Ok(SmartFolder {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    rules: serde_json::from_str(&rules_json).unwrap_or_default(),
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(folders)
    }

    pub fn get_smart_folder(&self, id: &str) -> Result<Option<SmartFolder>, String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        let mut stmt = conn
            .prepare(
                "SELECT id, name, rules_json, created_at, updated_at
                 FROM smart_folders
                 WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let folder = stmt
            .query_row(params![id], |row| {
                let rules_json: String = row.get(2)?;
                Ok(SmartFolder {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    rules: serde_json::from_str(&rules_json).unwrap_or_default(),
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .ok();
        Ok(folder)
    }

    pub fn create_smart_folder(&self, mut folder: SmartFolder) -> Result<SmartFolder, String> {
        if folder.id.trim().is_empty() {
            folder.id = Uuid::new_v4().to_string();
        }
        let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        folder.created_at = Some(folder.created_at.unwrap_or_else(|| now.clone()));
        folder.updated_at = Some(now);
        let rules_json = serde_json::to_string(&folder.rules)
            .map_err(|e| format!("Failed to serialize smart folder rules: {}", e))?;

        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute(
            "INSERT INTO smart_folders (id, name, rules_json, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                folder.id,
                folder.name,
                rules_json,
                folder.created_at,
                folder.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(folder)
    }

    pub fn update_smart_folder(
        &self,
        id: &str,
        mut folder: SmartFolder,
    ) -> Result<SmartFolder, String> {
        let existing = self
            .get_smart_folder(id)?
            .ok_or_else(|| format!("Smart folder not found: {}", id))?;
        folder.id = id.to_string();
        folder.created_at = existing.created_at;
        folder.updated_at = Some(chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string());
        let rules_json = serde_json::to_string(&folder.rules)
            .map_err(|e| format!("Failed to serialize smart folder rules: {}", e))?;

        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute(
            "UPDATE smart_folders
             SET name = ?1, rules_json = ?2, updated_at = ?3
             WHERE id = ?4",
            params![folder.name, rules_json, folder.updated_at, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(folder)
    }

    pub fn delete_smart_folder(&self, id: &str) -> Result<(), String> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| format!("Database lock poisoned: {}", e))?;
        conn.execute("DELETE FROM smart_folders WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn eval_smart_folder(&self, id: &str) -> Result<Vec<Work>, String> {
        let folder = self
            .get_smart_folder(id)?
            .ok_or_else(|| format!("Smart folder not found: {}", id))?;
        let mut works = self.get_all_works()?;

        for rule in folder.rules.iter().filter(|rule| {
            rule.field.contains("タグ") && rule.operator == "∋" && !rule.values.is_empty()
        }) {
            works.retain(|work| {
                rule.values
                    .iter()
                    .any(|value| work.tags.iter().any(|tag| tag == value))
            });
        }

        let mut result = Vec::new();
        for work in works {
            if let Some(full_work) = self.get_work(&work.id)? {
                result.push(full_work);
            }
        }
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_db() -> Database {
        Database::new(Path::new(":memory:")).unwrap()
    }

    fn make_test_work(id: &str, title: &str, tags: Vec<String>) -> Work {
        Work {
            id: id.to_string(),
            title: title.to_string(),
            cover_image: None,
            default_playlist: None,
            created_at: None,
            status: "normal".to_string(),
            physical_path: "/tmp/test".to_string(),
            total_duration_sec: 0,
            added_at: "2025-01-01T00:00:00Z".to_string(),
            error_message: None,
            urls: Vec::new(),
            tags,
            playlists: Vec::new(),
            bookmarked: false,
            last_played_at: None,
            resume_position: 0.0,
            resume_track_index: 0,
        }
    }

    #[test]
    fn test_new_creates_tables() {
        let db = create_test_db();
        // Verify tables exist by attempting operations
        let result = db.get_all_works();
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn test_set_and_get_setting() {
        let db = create_test_db();
        db.set_setting("test_key", "test_value").unwrap();
        let val = db.get_setting("test_key").unwrap();
        assert_eq!(val, Some("test_value".to_string()));
    }

    #[test]
    fn test_get_setting_nonexistent() {
        let db = create_test_db();
        let val = db.get_setting("nonexistent").unwrap();
        assert_eq!(val, None);
    }

    #[test]
    fn test_set_setting_overwrite() {
        let db = create_test_db();
        db.set_setting("key", "value1").unwrap();
        db.set_setting("key", "value2").unwrap();
        let val = db.get_setting("key").unwrap();
        assert_eq!(val, Some("value2".to_string()));
    }

    #[test]
    fn test_upsert_and_get_work() {
        let db = create_test_db();
        let work = make_test_work(
            "w1",
            "Test Work",
            vec!["ASMR".to_string(), "癒し".to_string()],
        );
        db.upsert_work(&work).unwrap();

        let retrieved = db.get_work("w1").unwrap().unwrap();
        assert_eq!(retrieved.id, "w1");
        assert_eq!(retrieved.title, "Test Work");
        assert_eq!(retrieved.tags, vec!["ASMR", "癒し"]);
        assert_eq!(retrieved.status, "normal");
    }

    #[test]
    fn test_get_work_nonexistent() {
        let db = create_test_db();
        let result = db.get_work("nonexistent").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_upsert_work_updates_existing() {
        let db = create_test_db();
        let work1 = make_test_work("w1", "Original Title", vec![]);
        db.upsert_work(&work1).unwrap();

        let work2 = make_test_work("w1", "Updated Title", vec!["tag1".to_string()]);
        db.upsert_work(&work2).unwrap();

        let retrieved = db.get_work("w1").unwrap().unwrap();
        assert_eq!(retrieved.title, "Updated Title");
        assert_eq!(retrieved.tags, vec!["tag1"]);
    }

    #[test]
    fn test_get_all_works() {
        let db = create_test_db();
        let w1 = make_test_work("w1", "Work 1", vec!["tag1".to_string()]);
        let w2 = make_test_work("w2", "Work 2", vec!["tag2".to_string()]);
        db.upsert_work(&w1).unwrap();
        db.upsert_work(&w2).unwrap();

        let all = db.get_all_works().unwrap();
        assert_eq!(all.len(), 2);
        // Verify tags are populated
        let titles: Vec<&str> = all.iter().map(|w| w.title.as_str()).collect();
        assert!(titles.contains(&"Work 1"));
        assert!(titles.contains(&"Work 2"));
    }

    #[test]
    fn test_search_works_by_title() {
        let db = create_test_db();
        db.upsert_work(&make_test_work("w1", "ASMR Collection", vec![]))
            .unwrap();
        db.upsert_work(&make_test_work("w2", "Music Album", vec![]))
            .unwrap();

        let results = db.search_works("asmr", &[]).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].title, "ASMR Collection");
    }

    #[test]
    fn test_search_works_by_tag() {
        let db = create_test_db();
        db.upsert_work(&make_test_work("w1", "Work 1", vec!["ASMR".to_string()]))
            .unwrap();
        db.upsert_work(&make_test_work("w2", "Work 2", vec!["Music".to_string()]))
            .unwrap();

        let results = db.search_works("", &["ASMR".to_string()]).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "w1");
    }

    #[test]
    fn test_search_works_empty_query() {
        let db = create_test_db();
        db.upsert_work(&make_test_work("w1", "Work 1", vec![]))
            .unwrap();
        db.upsert_work(&make_test_work("w2", "Work 2", vec![]))
            .unwrap();

        let results = db.search_works("", &[]).unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_works_by_tag_in_query() {
        let db = create_test_db();
        db.upsert_work(&make_test_work("w1", "Work 1", vec!["癒し".to_string()]))
            .unwrap();
        db.upsert_work(&make_test_work("w2", "Work 2", vec![]))
            .unwrap();

        // Query text also searches tags
        let results = db.search_works("癒し", &[]).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "w1");
    }

    #[test]
    fn test_update_work_tags() {
        let db = create_test_db();
        db.upsert_work(&make_test_work("w1", "Work 1", vec!["old_tag".to_string()]))
            .unwrap();

        db.update_work_tags("w1", &["new_tag1".to_string(), "new_tag2".to_string()])
            .unwrap();

        let work = db.get_work("w1").unwrap().unwrap();
        assert_eq!(work.tags.len(), 2);
        assert!(work.tags.contains(&"new_tag1".to_string()));
        assert!(work.tags.contains(&"new_tag2".to_string()));
        assert!(!work.tags.contains(&"old_tag".to_string()));
    }

    #[test]
    fn test_toggle_bookmark() {
        let db = create_test_db();
        db.upsert_work(&make_test_work("w1", "Work 1", vec![]))
            .unwrap();

        // Initially not bookmarked
        let work = db.get_work("w1").unwrap().unwrap();
        assert!(!work.bookmarked);

        // Toggle on
        let result = db.toggle_bookmark("w1").unwrap();
        assert!(result);

        let work = db.get_work("w1").unwrap().unwrap();
        assert!(work.bookmarked);

        // Toggle off
        let result = db.toggle_bookmark("w1").unwrap();
        assert!(!result);

        let work = db.get_work("w1").unwrap().unwrap();
        assert!(!work.bookmarked);
    }

    #[test]
    fn test_save_resume_position() {
        let db = create_test_db();
        db.upsert_work(&make_test_work("w1", "Work 1", vec![]))
            .unwrap();

        db.save_resume_position("w1", 42.5, 3).unwrap();

        let work = db.get_work("w1").unwrap().unwrap();
        assert!((work.resume_position - 42.5).abs() < f64::EPSILON);
        assert_eq!(work.resume_track_index, 3);
    }

    #[test]
    fn test_mark_all_missing_and_mark_found() {
        let db = create_test_db();
        db.upsert_work(&make_test_work("w1", "Work 1", vec![]))
            .unwrap();
        db.upsert_work(&make_test_work("w2", "Work 2", vec![]))
            .unwrap();

        // Mark all missing
        db.mark_all_missing().unwrap();

        let all = db.get_all_works().unwrap();
        assert!(all.iter().all(|w| w.status == "missing"));

        // Mark one found
        db.mark_found("w1").unwrap();

        let w1 = db.get_work("w1").unwrap().unwrap();
        let w2 = db.get_work("w2").unwrap().unwrap();
        assert_eq!(w1.status, "normal");
        assert_eq!(w2.status, "missing");
    }

    #[test]
    fn test_search_preset_crud() {
        let db = create_test_db();

        // Save
        let id = db
            .save_search_preset(
                "My Preset",
                "asmr",
                &["tag1".to_string(), "tag2".to_string()],
                "title-asc",
            )
            .unwrap();
        assert!(id > 0);

        // Get
        let presets = db.get_search_presets().unwrap();
        assert_eq!(presets.len(), 1);
        assert_eq!(presets[0].name, "My Preset");
        assert_eq!(presets[0].query, "asmr");
        assert_eq!(presets[0].tag_filters, vec!["tag1", "tag2"]);
        assert_eq!(presets[0].sort_id, "title-asc");

        // Delete
        db.delete_search_preset(id).unwrap();
        let presets = db.get_search_presets().unwrap();
        assert!(presets.is_empty());
    }

    #[test]
    fn test_get_all_tags_only_associated() {
        let db = create_test_db();

        // Insert a work with tags
        db.upsert_work(&make_test_work(
            "w1",
            "Work 1",
            vec!["ASMR".to_string(), "癒し".to_string()],
        ))
        .unwrap();

        // Create an orphan tag by adding then removing it
        db.upsert_work(&make_test_work(
            "w2",
            "Work 2",
            vec!["orphan_tag".to_string()],
        ))
        .unwrap();
        db.delete_work("w2").unwrap();

        let tags = db.get_all_tags().unwrap();
        // orphan_tag should not appear since it has no associated work
        assert_eq!(tags.len(), 2);
        assert!(tags.contains(&"ASMR".to_string()));
        assert!(tags.contains(&"癒し".to_string()));
        assert!(!tags.contains(&"orphan_tag".to_string()));
    }

    #[test]
    fn test_delete_work() {
        let db = create_test_db();
        db.upsert_work(&make_test_work("w1", "Work 1", vec!["tag".to_string()]))
            .unwrap();

        db.delete_work("w1").unwrap();
        assert!(db.get_work("w1").unwrap().is_none());
    }
}
