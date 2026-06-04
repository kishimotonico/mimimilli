use std::fs;
use std::path::{Path, PathBuf};

use crate::db::Database;
use crate::dlsite::{self, DlsiteWorkInfo};
use crate::models::{
    AxisFacetItem, FileEntry, MetaFile, ScanResult, SearchPreset, SmartFolder, UrlEntry, Work,
    WorkSummary,
};
use crate::scanner;

pub struct AppService {
    pub db: Database,
}

impl AppService {
    pub fn new(app_data_dir: &Path) -> Result<Self, String> {
        fs::create_dir_all(app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;

        let db_path = app_data_dir.join("mimikago.db");
        let db = Database::new(&db_path)?;

        Ok(AppService { db })
    }

    pub fn get_root_folder(&self) -> Result<Option<String>, String> {
        self.db.get_setting("root_folder")
    }

    pub fn set_root_folder(&self, path: &str) -> Result<(), String> {
        let p = Path::new(path);
        if !p.is_dir() {
            return Err(format!("Path is not a directory: {}", path));
        }
        self.db.set_setting("root_folder", path)
    }

    pub fn scan(&self) -> Result<ScanResult, String> {
        let root = self.get_root_folder()?.ok_or("Root folder not set")?;
        let root_path = PathBuf::from(&root);

        if !root_path.is_dir() {
            return Err(format!("Root folder does not exist: {}", root));
        }

        scanner::scan_library(&root_path, &self.db)
    }

    pub fn get_all_works(&self) -> Result<Vec<WorkSummary>, String> {
        self.db.get_all_works()
    }

    pub fn get_all_works_filtered(
        &self,
        axis: Option<&str>,
        axis_value: Option<&str>,
        sort: Option<&str>,
        view: Option<&str>,
    ) -> Result<Vec<WorkSummary>, String> {
        if axis.is_none() && axis_value.is_none() && sort.is_none() && view.is_none() {
            return self.get_all_works();
        }
        self.db.get_all_works_filtered(axis, axis_value, sort, view)
    }

    pub fn get_work(&self, id: &str) -> Result<Option<Work>, String> {
        self.db.get_work(id)
    }

    pub fn search_works(
        &self,
        query: &str,
        tag_filters: &[String],
    ) -> Result<Vec<WorkSummary>, String> {
        self.db.search_works(query, tag_filters)
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
        if axis.is_none()
            && axis_value.is_none()
            && tag_op.is_none()
            && sort.is_none()
            && view.is_none()
        {
            return self.search_works(query, tag_filters);
        }
        self.db
            .search_works_filtered(query, tag_filters, axis, axis_value, tag_op, sort, view)
    }

    pub fn update_work_tags(&self, work_id: &str, tags: Vec<String>) -> Result<(), String> {
        // Update DB
        self.db.update_work_tags(&work_id, &tags)?;

        // Write back to meta file
        if let Some(work) = self.db.get_work(work_id)? {
            self.write_back_meta(&work, Some(tags))?;
        }

        Ok(())
    }

    pub fn update_work_title(&self, work_id: &str, title: &str) -> Result<(), String> {
        if let Some(mut work) = self.db.get_work(work_id)? {
            work.title = title.to_string();
            self.db.upsert_work(&work)?;
            self.write_back_meta(&work, None)?;
        }
        Ok(())
    }

    pub fn get_all_tags(&self) -> Result<Vec<String>, String> {
        self.db.get_all_tags()
    }

    pub fn get_cover_image_path(&self, work_id: &str) -> Result<Option<String>, String> {
        let work = self.db.get_work(work_id)?;
        if let Some(w) = work {
            if let Some(cover) = &w.cover_image {
                let full_path = Path::new(&w.physical_path).join(cover);
                let resolved = full_path.canonicalize().map_err(|e| e.to_string())?;
                let work_dir = Path::new(&w.physical_path)
                    .canonicalize()
                    .map_err(|e| e.to_string())?;
                if !resolved.starts_with(&work_dir) {
                    return Err("Path traversal detected".to_string());
                }
                if resolved.exists() {
                    return Ok(Some(resolved.to_string_lossy().to_string()));
                }
            }
        }
        Ok(None)
    }

    pub fn get_audio_file_path(
        &self,
        work_id: &str,
        relative_path: &str,
    ) -> Result<Option<String>, String> {
        let work = self.db.get_work(work_id)?;
        if let Some(w) = work {
            let full_path = Path::new(&w.physical_path).join(relative_path);
            let resolved = full_path.canonicalize().map_err(|e| e.to_string())?;
            let work_dir = Path::new(&w.physical_path)
                .canonicalize()
                .map_err(|e| e.to_string())?;
            if !resolved.starts_with(&work_dir) {
                return Err("Path traversal detected".to_string());
            }
            if resolved.exists() {
                return Ok(Some(resolved.to_string_lossy().to_string()));
            }
        }
        Ok(None)
    }

    pub fn get_last_scan_time(&self) -> Result<Option<String>, String> {
        self.db.get_setting("last_scan_time")
    }

    pub fn toggle_bookmark(&self, work_id: &str) -> Result<bool, String> {
        self.db.toggle_bookmark(work_id)
    }

    pub fn update_last_played(&self, work_id: &str) -> Result<(), String> {
        self.db.update_last_played(work_id)
    }

    pub fn save_resume_position(
        &self,
        work_id: &str,
        position: f64,
        track_index: i32,
    ) -> Result<(), String> {
        self.db.save_resume_position(work_id, position, track_index)
    }

    pub fn save_search_preset(
        &self,
        name: &str,
        query: &str,
        tag_filters: &[String],
        sort_id: &str,
    ) -> Result<i64, String> {
        self.db
            .save_search_preset(name, query, tag_filters, sort_id)
    }

    pub fn get_search_presets(&self) -> Result<Vec<SearchPreset>, String> {
        self.db.get_search_presets()
    }

    pub fn delete_search_preset(&self, id: i64) -> Result<(), String> {
        self.db.delete_search_preset(id)
    }

    pub fn get_axis_facets(&self, axis: &str) -> Result<Vec<AxisFacetItem>, String> {
        self.db.get_axis_facets(axis)
    }

    pub fn list_smart_folders(&self) -> Result<Vec<SmartFolder>, String> {
        self.db.list_smart_folders()
    }

    pub fn get_smart_folder(&self, id: &str) -> Result<Option<SmartFolder>, String> {
        self.db.get_smart_folder(id)
    }

    pub fn create_smart_folder(&self, folder: SmartFolder) -> Result<SmartFolder, String> {
        self.db.create_smart_folder(folder)
    }

    pub fn update_smart_folder(
        &self,
        id: &str,
        folder: SmartFolder,
    ) -> Result<SmartFolder, String> {
        self.db.update_smart_folder(id, folder)
    }

    pub fn delete_smart_folder(&self, id: &str) -> Result<(), String> {
        self.db.delete_smart_folder(id)
    }

    pub fn eval_smart_folder(&self, id: &str) -> Result<Vec<Work>, String> {
        self.db.eval_smart_folder(id)
    }

    pub fn list_work_files(&self, work_id: &str) -> Result<Option<FileEntry>, String> {
        let work = self.db.get_work(work_id)?;
        if let Some(w) = work {
            let root_path = Path::new(&w.physical_path);
            if !root_path.is_dir() {
                return Ok(None);
            }
            let entry = build_file_tree(root_path, root_path)?;
            return Ok(Some(entry));
        }
        Ok(None)
    }

    pub fn export_library(&self) -> Result<String, String> {
        let works = self.db.get_all_works()?;
        let presets = self.db.get_search_presets()?;
        let root = self.get_root_folder()?;

        let export = serde_json::json!({
            "version": 1,
            "rootFolder": root,
            "works": works,
            "searchPresets": presets,
        });

        serde_json::to_string_pretty(&export)
            .map_err(|e| format!("Failed to serialize export: {}", e))
    }

    pub fn fetch_dlsite_info(&self, work_id: &str) -> Result<DlsiteWorkInfo, String> {
        let work = self
            .db
            .get_work(work_id)?
            .ok_or_else(|| format!("Work not found: {}", work_id))?;

        // Try to extract RJ code from folder name or title
        let folder_name = Path::new(&work.physical_path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        let rj_code = dlsite::extract_rj_code(folder_name)
            .or_else(|| dlsite::extract_rj_code(&work.title))
            .ok_or_else(|| {
                "RJコードが見つかりません。フォルダ名またはタイトルにRJコードを含めてください。"
                    .to_string()
            })?;

        dlsite::fetch_dlsite_info(&rj_code)
    }

    pub fn apply_dlsite_info(
        &self,
        work_id: &str,
        info: &DlsiteWorkInfo,
        apply_title: bool,
        apply_tags: bool,
        apply_cover: bool,
    ) -> Result<(), String> {
        let mut work = self
            .db
            .get_work(work_id)?
            .ok_or_else(|| format!("Work not found: {}", work_id))?;

        if apply_title {
            work.title = info.title.clone();
        }

        if apply_tags {
            // Merge genre tags (avoid duplicates)
            let mut tags = work.tags.clone();
            for tag in &info.genre_tags {
                if !tags.contains(tag) {
                    tags.push(tag.clone());
                }
            }
            // Add CV tags with prefix
            for cv in &info.cvs {
                let cv_tag = format!("CV/{}", cv);
                if !tags.contains(&cv_tag) {
                    tags.push(cv_tag);
                }
            }
            // Add circle tag
            if let Some(ref circle) = info.circle {
                let circle_tag = format!("サークル/{}", circle);
                if !tags.contains(&circle_tag) {
                    tags.push(circle_tag);
                }
            }
            work.tags = tags;
        }

        // Add DLsite URL if not already present
        let dlsite_url_exists = work.urls.iter().any(|u| u.url.contains("dlsite.com"));
        if !dlsite_url_exists {
            work.urls.push(UrlEntry {
                label: "DLsite".to_string(),
                url: info.url.clone(),
            });
        }

        // Download cover image
        if apply_cover {
            if let Some(ref cover_url) = info.cover_url {
                let save_path = Path::new(&work.physical_path);
                match dlsite::download_cover_image(cover_url, save_path) {
                    Ok(filename) => {
                        work.cover_image = Some(filename);
                    }
                    Err(e) => {
                        log::warn!("Failed to download cover: {}", e);
                    }
                }
            }
        }

        self.db.upsert_work(&work)?;
        self.write_back_meta(&work, Some(work.tags.clone()))?;

        Ok(())
    }

    fn write_back_meta(
        &self,
        work: &Work,
        tags_override: Option<Vec<String>>,
    ) -> Result<(), String> {
        let meta_path = Path::new(&work.physical_path).join(".meta.json");
        if !meta_path.exists() {
            // Try single-file meta pattern
            return Ok(());
        }

        let content =
            fs::read_to_string(&meta_path).map_err(|e| format!("Failed to read meta: {}", e))?;

        let mut meta: MetaFile =
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse meta: {}", e))?;

        meta.title = work.title.clone();
        if let Some(tags) = tags_override {
            meta.tags = tags;
        }
        meta.urls = work.urls.clone();

        let json = serde_json::to_string_pretty(&meta)
            .map_err(|e| format!("Failed to serialize: {}", e))?;

        fs::write(&meta_path, &json).map_err(|e| format!("Failed to write meta: {}", e))?;

        Ok(())
    }
}

fn build_file_tree(dir: &Path, work_root: &Path) -> Result<FileEntry, String> {
    let name = dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let relative = dir.strip_prefix(work_root).unwrap_or(dir);
    let mut children = Vec::new();

    if let Ok(entries) = fs::read_dir(dir) {
        let mut items: Vec<_> = entries.flatten().collect();
        items.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

        for entry in items {
            let path = entry.path();
            let fname = entry.file_name().to_string_lossy().to_string();

            if fname.starts_with('.') {
                continue; // skip hidden files
            }

            if path.is_dir() {
                let child = build_file_tree(&path, work_root)?;
                children.push(child);
            } else {
                let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                let file_type = match ext.as_str() {
                    "mp3" | "m4a" | "aac" | "wav" | "ogg" | "flac" | "webm" | "opus" => "audio",
                    "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" => "image",
                    "pdf" => "pdf",
                    "txt" | "md" | "nfo" => "text",
                    _ => "other",
                };
                let child_relative = path.strip_prefix(work_root).unwrap_or(&path);
                children.push(FileEntry {
                    name: fname,
                    path: child_relative.to_string_lossy().to_string(),
                    is_dir: false,
                    size,
                    file_type: file_type.to_string(),
                    children: Vec::new(),
                });
            }
        }
    }

    Ok(FileEntry {
        name,
        path: relative.to_string_lossy().to_string(),
        is_dir: true,
        size: 0,
        file_type: "directory".to_string(),
        children,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_file_tree_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();

        let tree = build_file_tree(root, root).unwrap();
        assert!(tree.is_dir);
        assert_eq!(tree.file_type, "directory");
        assert!(tree.children.is_empty());
    }

    #[test]
    fn test_build_file_tree_with_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("track.mp3"), "audio data").unwrap();
        std::fs::write(root.join("cover.jpg"), "image data").unwrap();
        std::fs::write(root.join("notes.txt"), "text data").unwrap();

        let tree = build_file_tree(root, root).unwrap();
        assert_eq!(tree.children.len(), 3);

        let types: Vec<&str> = tree.children.iter().map(|c| c.file_type.as_str()).collect();
        assert!(types.contains(&"audio"));
        assert!(types.contains(&"image"));
        assert!(types.contains(&"text"));
    }

    #[test]
    fn test_build_file_tree_nested_dirs() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let sub = root.join("subdir");
        std::fs::create_dir(&sub).unwrap();
        std::fs::write(sub.join("track.flac"), "audio").unwrap();

        let tree = build_file_tree(root, root).unwrap();
        assert_eq!(tree.children.len(), 1);
        let subdir_entry = &tree.children[0];
        assert!(subdir_entry.is_dir);
        assert_eq!(subdir_entry.name, "subdir");
        assert_eq!(subdir_entry.children.len(), 1);
        assert_eq!(subdir_entry.children[0].file_type, "audio");
    }

    #[test]
    fn test_build_file_tree_hidden_files_skipped() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join(".meta.json"), "{}").unwrap();
        std::fs::write(root.join(".hidden"), "secret").unwrap();
        std::fs::write(root.join("visible.mp3"), "audio").unwrap();

        let tree = build_file_tree(root, root).unwrap();
        assert_eq!(tree.children.len(), 1);
        assert_eq!(tree.children[0].name, "visible.mp3");
    }

    #[test]
    fn test_build_file_tree_file_types() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("a.mp3"), "").unwrap();
        std::fs::write(root.join("b.m4a"), "").unwrap();
        std::fs::write(root.join("c.wav"), "").unwrap();
        std::fs::write(root.join("d.ogg"), "").unwrap();
        std::fs::write(root.join("e.flac"), "").unwrap();
        std::fs::write(root.join("f.opus"), "").unwrap();
        std::fs::write(root.join("g.png"), "").unwrap();
        std::fs::write(root.join("h.pdf"), "").unwrap();
        std::fs::write(root.join("i.md"), "").unwrap();
        std::fs::write(root.join("j.xyz"), "").unwrap();

        let tree = build_file_tree(root, root).unwrap();
        let mut type_map: std::collections::HashMap<String, Vec<String>> =
            std::collections::HashMap::new();
        for child in &tree.children {
            type_map
                .entry(child.file_type.clone())
                .or_default()
                .push(child.name.clone());
        }
        assert_eq!(type_map.get("audio").map(|v| v.len()).unwrap_or(0), 6);
        assert_eq!(type_map.get("image").map(|v| v.len()).unwrap_or(0), 1);
        assert_eq!(type_map.get("pdf").map(|v| v.len()).unwrap_or(0), 1);
        assert_eq!(type_map.get("text").map(|v| v.len()).unwrap_or(0), 1);
        assert_eq!(type_map.get("other").map(|v| v.len()).unwrap_or(0), 1);
    }

    #[test]
    fn test_build_file_tree_relative_paths() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let sub = root.join("inner");
        std::fs::create_dir(&sub).unwrap();
        std::fs::write(sub.join("file.mp3"), "").unwrap();

        let tree = build_file_tree(root, root).unwrap();
        let inner = &tree.children[0];
        assert_eq!(inner.path, "inner");
        let file = &inner.children[0];
        assert_eq!(file.path, "inner/file.mp3");
    }

    #[test]
    fn test_build_file_tree_file_size() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let content = "hello world"; // 11 bytes
        std::fs::write(root.join("test.txt"), content).unwrap();

        let tree = build_file_tree(root, root).unwrap();
        assert_eq!(tree.children[0].size, 11);
    }
}
