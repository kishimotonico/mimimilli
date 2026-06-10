use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use crate::db::Database;
use crate::models::{MetaFile, Playlist, ScanResult, Track, Work};

const AUDIO_EXTENSIONS: &[&str] = &["mp3", "m4a", "aac", "wav", "ogg", "flac", "webm", "opus"];
const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "bmp", "webp"];

pub fn scan_library(root: &Path, db: &Database) -> Result<ScanResult, String> {
    let mut result = ScanResult {
        registered: 0,
        newly_generated: 0,
        errors: 0,
        missing: 0,
        new_work_ids: Vec::new(),
    };

    // Mark all existing works as missing; found ones will be restored
    db.mark_all_missing()?;

    let mut found_ids = std::collections::HashSet::new();

    // Walk the directory tree looking for .meta.json files
    for entry in WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

        if file_name == ".meta.json" {
            match process_meta_file(path, db) {
                Ok(work_id) => {
                    found_ids.insert(work_id);
                    result.registered += 1;
                }
                Err(e) => {
                    log::warn!("Error processing {}: {}", path.display(), e);
                    result.errors += 1;
                }
            }
        } else if file_name.ends_with(".meta.json") && !file_name.starts_with('.') {
            // Single file meta: e.g., "d00001.meta.json"
            match process_meta_file(path, db) {
                Ok(work_id) => {
                    found_ids.insert(work_id);
                    result.registered += 1;
                }
                Err(e) => {
                    log::warn!("Error processing {}: {}", path.display(), e);
                    result.errors += 1;
                }
            }
        }
    }

    // Auto-generate meta files for folders with audio but no meta
    let generated = auto_generate_meta_files(root, &found_ids, db)?;
    for id in &generated {
        result.new_work_ids.push(id.clone());
    }
    result.newly_generated = generated.len();

    // Count remaining missing works
    let all_works = db.get_all_works()?;
    result.missing = all_works.iter().filter(|w| w.status == "missing").count();

    Ok(result)
}

fn process_meta_file(meta_path: &Path, db: &Database) -> Result<String, String> {
    let content = fs::read_to_string(meta_path)
        .map_err(|e| format!("Failed to read {}: {}", meta_path.display(), e))?;

    let meta: MetaFile = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse {}: {}", meta_path.display(), e))?;

    let work_dir = if meta_path.file_name().map(|n| n.to_str()) == Some(Some(".meta.json")) {
        meta_path.parent().unwrap_or(meta_path).to_path_buf()
    } else {
        meta_path.parent().unwrap_or(meta_path).to_path_buf()
    };

    let physical_path = work_dir.to_string_lossy().to_string();

    let total_duration = calculate_total_duration(&meta);

    let mut error_message = None;
    if let Some(playlist) = get_default_playlist(&meta) {
        let missing_files: Vec<String> = playlist
            .tracks
            .iter()
            .filter(|t| {
                let track_path = work_dir.join(&t.file);
                !track_path.exists()
            })
            .map(|t| t.file.clone())
            .collect();

        if !missing_files.is_empty() {
            error_message = Some(format!("Missing files: {}", missing_files.join(", ")));
        }
    }

    let status = if error_message.is_some() {
        "error"
    } else {
        "normal"
    };

    // Preserve existing work data (bookmarks, resume, last_played, added_at)
    let (added_at, bookmarked, last_played_at, resume_position, resume_track_index) =
        if let Ok(Some(existing)) = db.get_work(&meta.id) {
            (
                existing.added_at,
                existing.bookmarked,
                existing.last_played_at,
                existing.resume_position,
                existing.resume_track_index,
            )
        } else {
            (
                chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                false,
                None,
                0.0,
                0,
            )
        };

    let work = Work {
        id: meta.id.clone(),
        title: meta.title,
        cover_image: meta.cover_image,
        default_playlist: meta.default_playlist,
        created_at: meta.created_at,
        status: status.to_string(),
        physical_path: physical_path.clone(),
        total_duration_sec: total_duration,
        added_at,
        error_message,
        urls: meta.urls,
        tags: meta.tags,
        playlists: meta.playlists,
        bookmarked,
        last_played_at,
        resume_position,
        resume_track_index,
    };

    db.upsert_work(&work)?;

    // If the work existed before (move tracking), update path and mark found
    if let Ok(Some(old_path)) = db.find_work_by_id_any_path(&meta.id) {
        if old_path != physical_path {
            db.update_work_path(&meta.id, &physical_path)?;
        }
        db.mark_found(&meta.id)?;
    }

    Ok(meta.id)
}

fn get_default_playlist(meta: &MetaFile) -> Option<&Playlist> {
    if meta.playlists.is_empty() {
        return None;
    }

    if let Some(ref default_name) = meta.default_playlist {
        meta.playlists.iter().find(|p| &p.name == default_name)
    } else {
        meta.playlists.first()
    }
}

fn calculate_total_duration(meta: &MetaFile) -> i64 {
    // We can't calculate actual duration from file metadata in phase 1
    // Return 0 and let the frontend calculate from audio elements
    if let Some(playlist) = get_default_playlist(meta) {
        // For single-file format with start/end, we can calculate
        let mut total = 0.0;
        for track in &playlist.tracks {
            if let (Some(start), Some(end)) = (track.start, track.end) {
                total += end - start;
            }
        }
        total as i64
    } else {
        0
    }
}

fn auto_generate_meta_files(
    root: &Path,
    existing_ids: &std::collections::HashSet<String>,
    db: &Database,
) -> Result<Vec<String>, String> {
    let mut generated = Vec::new();

    // Find directories containing audio files but no .meta.json
    let mut audio_dirs: Vec<PathBuf> = Vec::new();

    for entry in WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                // Check if this audio file's folder (or any ancestor up to root) already has a meta file
                let mut dir = path.parent().unwrap().to_path_buf();
                let mut has_meta = false;

                loop {
                    let meta_path = dir.join(".meta.json");
                    if meta_path.exists() {
                        has_meta = true;
                        break;
                    }
                    // Also check for single-file meta patterns
                    if let Ok(entries) = fs::read_dir(&dir) {
                        for e in entries.flatten() {
                            if let Some(name) = e.file_name().to_str() {
                                if name.ends_with(".meta.json") {
                                    has_meta = true;
                                    break;
                                }
                            }
                        }
                    }
                    if has_meta || dir == root || !dir.starts_with(root) {
                        break;
                    }
                    dir = match dir.parent() {
                        Some(p) => p.to_path_buf(),
                        None => break,
                    };
                }

                if !has_meta {
                    // Find the topmost audio-containing directory under root
                    let work_dir = find_work_root(path.parent().unwrap(), root);
                    if !audio_dirs.contains(&work_dir) {
                        audio_dirs.push(work_dir);
                    }
                }
            }
        }
    }

    for dir in audio_dirs {
        match generate_meta_for_folder(&dir, db) {
            Ok(id) => {
                if !existing_ids.contains(&id) {
                    generated.push(id);
                }
            }
            Err(e) => {
                log::warn!("Failed to generate meta for {}: {}", dir.display(), e);
            }
        }
    }

    Ok(generated)
}

fn find_work_root(audio_dir: &Path, root: &Path) -> PathBuf {
    // Walk up from the audio directory to find the work root
    // The work root is the first directory under root's children that contains audio
    let mut current = audio_dir.to_path_buf();
    let mut last_valid = current.clone();

    while current != root && current.starts_with(root) {
        last_valid = current.clone();
        current = match current.parent() {
            Some(p) => p.to_path_buf(),
            None => break,
        };
    }

    last_valid
}

fn generate_meta_for_folder(dir: &Path, db: &Database) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();

    // Title from folder name
    let title = dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    // Find cover image
    let cover_image = find_cover_image(dir);

    // Find audio files and build playlist
    let tracks = build_default_tracks(dir);

    let playlists = if tracks.is_empty() {
        Vec::new()
    } else {
        vec![Playlist {
            name: "default".to_string(),
            tracks,
        }]
    };

    let meta = MetaFile {
        id: id.clone(),
        title: title.clone(),
        urls: Vec::new(),
        tags: Vec::new(),
        cover_image: cover_image.clone(),
        playlists: playlists.clone(),
        default_playlist: Some("default".to_string()),
        created_at: Some(chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()),
    };

    // Write meta file
    let meta_path = dir.join(".meta.json");
    let json = serde_json::to_string_pretty(&meta)
        .map_err(|e| format!("Failed to serialize meta: {}", e))?;
    fs::write(&meta_path, &json)
        .map_err(|e| format!("Failed to write {}: {}", meta_path.display(), e))?;

    // Also add to DB
    let physical_path = dir.to_string_lossy().to_string();
    let _track_count = meta.playlists.first().map(|p| p.tracks.len()).unwrap_or(0);

    let work = Work {
        id: id.clone(),
        title,
        cover_image,
        default_playlist: Some("default".to_string()),
        created_at: meta.created_at.clone(),
        status: "normal".to_string(),
        physical_path,
        total_duration_sec: 0,
        added_at: chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        error_message: None,
        urls: Vec::new(),
        tags: Vec::new(),
        playlists,
        bookmarked: false,
        last_played_at: None,
        resume_position: 0.0,
        resume_track_index: 0,
    };

    db.upsert_work(&work)?;

    Ok(id)
}

fn find_cover_image(dir: &Path) -> Option<String> {
    // Look for image files in the directory
    if let Ok(entries) = fs::read_dir(dir) {
        let mut images: Vec<String> = entries
            .flatten()
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                let ext = e.path().extension()?.to_str()?.to_lowercase();
                if IMAGE_EXTENSIONS.contains(&ext.as_str()) {
                    Some(name)
                } else {
                    None
                }
            })
            .collect();

        images.sort();

        // Prefer files named "cover" or "jacket"
        if let Some(cover) = images.iter().find(|n| {
            let lower = n.to_lowercase();
            lower.contains("cover") || lower.contains("jacket")
        }) {
            return Some(cover.clone());
        }

        images.first().cloned()
    } else {
        None
    }
}

fn build_default_tracks(dir: &Path) -> Vec<Track> {
    // Find the subfolder structure and pick the best one
    let mut direct_audio: Vec<PathBuf> = Vec::new();
    let mut subfolder_audio: std::collections::HashMap<PathBuf, Vec<PathBuf>> =
        std::collections::HashMap::new();

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                        direct_audio.push(path);
                    }
                }
            } else if path.is_dir() {
                collect_audio_recursive(&path, &mut subfolder_audio);
            }
        }
    }

    // If there are subfolder audio files, pick the subfolder with most files
    if !subfolder_audio.is_empty() && direct_audio.is_empty() {
        let best_subfolder = subfolder_audio.iter().max_by_key(|(_, files)| files.len());

        if let Some((_, files)) = best_subfolder {
            let mut sorted_files = files.clone();
            natural_sort(&mut sorted_files);

            return sorted_files
                .iter()
                .map(|f| {
                    let relative = f.strip_prefix(dir).unwrap_or(f);
                    let title = f
                        .file_stem()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string();
                    Track {
                        title,
                        file: relative.to_string_lossy().to_string(),
                        start: None,
                        end: None,
                    }
                })
                .collect();
        }
    }

    // Use direct audio files
    natural_sort(&mut direct_audio);
    direct_audio
        .iter()
        .map(|f| {
            let relative = f.strip_prefix(dir).unwrap_or(f);
            let title = f
                .file_stem()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();
            Track {
                title,
                file: relative.to_string_lossy().to_string(),
                start: None,
                end: None,
            }
        })
        .collect()
}

fn collect_audio_recursive(dir: &Path, map: &mut std::collections::HashMap<PathBuf, Vec<PathBuf>>) {
    for entry in WalkDir::new(dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if AUDIO_EXTENSIONS.contains(&ext.to_lowercase().as_str()) {
                    let parent = path.parent().unwrap_or(dir).to_path_buf();
                    map.entry(parent).or_default().push(path.to_path_buf());
                }
            }
        }
    }
}

fn natural_sort(paths: &mut Vec<PathBuf>) {
    paths.sort_by(|a, b| {
        let a_name = a.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let b_name = b.file_name().and_then(|n| n.to_str()).unwrap_or("");
        natural_cmp(a_name, b_name)
    });
}

fn natural_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let mut a_chars = a.chars().peekable();
    let mut b_chars = b.chars().peekable();

    loop {
        match (a_chars.peek(), b_chars.peek()) {
            (None, None) => return std::cmp::Ordering::Equal,
            (None, Some(_)) => return std::cmp::Ordering::Less,
            (Some(_), None) => return std::cmp::Ordering::Greater,
            (Some(&ac), Some(&bc)) => {
                if ac.is_ascii_digit() && bc.is_ascii_digit() {
                    let a_num: String = a_chars
                        .by_ref()
                        .take_while(|c| c.is_ascii_digit())
                        .collect();
                    let b_num: String = b_chars
                        .by_ref()
                        .take_while(|c| c.is_ascii_digit())
                        .collect();
                    let a_val: u64 = a_num.parse().unwrap_or(0);
                    let b_val: u64 = b_num.parse().unwrap_or(0);
                    match a_val.cmp(&b_val) {
                        std::cmp::Ordering::Equal => continue,
                        other => return other,
                    }
                } else {
                    a_chars.next();
                    b_chars.next();
                    match ac.to_lowercase().cmp(bc.to_lowercase()) {
                        std::cmp::Ordering::Equal => continue,
                        other => return other,
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cmp::Ordering;

    // --- natural_cmp tests ---

    #[test]
    fn test_natural_cmp_equal() {
        assert_eq!(natural_cmp("abc", "abc"), Ordering::Equal);
    }

    #[test]
    fn test_natural_cmp_alphabetic() {
        assert_eq!(natural_cmp("abc", "def"), Ordering::Less);
        assert_eq!(natural_cmp("def", "abc"), Ordering::Greater);
    }

    #[test]
    fn test_natural_cmp_numeric() {
        assert_eq!(natural_cmp("track2", "track10"), Ordering::Less);
        assert_eq!(natural_cmp("track10", "track2"), Ordering::Greater);
    }

    #[test]
    fn test_natural_cmp_case_insensitive() {
        assert_eq!(natural_cmp("ABC", "abc"), Ordering::Equal);
    }

    #[test]
    fn test_natural_cmp_empty() {
        assert_eq!(natural_cmp("", ""), Ordering::Equal);
        assert_eq!(natural_cmp("", "a"), Ordering::Less);
        assert_eq!(natural_cmp("a", ""), Ordering::Greater);
    }

    #[test]
    fn test_natural_cmp_prefix() {
        assert_eq!(natural_cmp("track", "track1"), Ordering::Less);
    }

    #[test]
    fn test_natural_cmp_numbers_only() {
        assert_eq!(natural_cmp("1", "2"), Ordering::Less);
        assert_eq!(natural_cmp("10", "2"), Ordering::Greater);
        assert_eq!(natural_cmp("100", "100"), Ordering::Equal);
    }

    // --- calculate_total_duration tests ---

    #[test]
    fn test_calculate_total_duration_with_start_end() {
        let meta = MetaFile {
            id: "test".to_string(),
            title: "Test".to_string(),
            urls: Vec::new(),
            tags: Vec::new(),
            cover_image: None,
            playlists: vec![Playlist {
                name: "default".to_string(),
                tracks: vec![
                    Track {
                        title: "T1".to_string(),
                        file: "t1.mp3".to_string(),
                        start: Some(0.0),
                        end: Some(60.0),
                    },
                    Track {
                        title: "T2".to_string(),
                        file: "t2.mp3".to_string(),
                        start: Some(60.0),
                        end: Some(180.0),
                    },
                ],
            }],
            default_playlist: Some("default".to_string()),
            created_at: None,
        };
        assert_eq!(calculate_total_duration(&meta), 180);
    }

    #[test]
    fn test_calculate_total_duration_no_start_end() {
        let meta = MetaFile {
            id: "test".to_string(),
            title: "Test".to_string(),
            urls: Vec::new(),
            tags: Vec::new(),
            cover_image: None,
            playlists: vec![Playlist {
                name: "default".to_string(),
                tracks: vec![Track {
                    title: "T1".to_string(),
                    file: "t1.mp3".to_string(),
                    start: None,
                    end: None,
                }],
            }],
            default_playlist: None,
            created_at: None,
        };
        assert_eq!(calculate_total_duration(&meta), 0);
    }

    #[test]
    fn test_calculate_total_duration_empty_playlists() {
        let meta = MetaFile {
            id: "test".to_string(),
            title: "Test".to_string(),
            urls: Vec::new(),
            tags: Vec::new(),
            cover_image: None,
            playlists: Vec::new(),
            default_playlist: None,
            created_at: None,
        };
        assert_eq!(calculate_total_duration(&meta), 0);
    }

    // --- get_default_playlist tests ---

    #[test]
    fn test_get_default_playlist_by_name() {
        let meta = MetaFile {
            id: "test".to_string(),
            title: "Test".to_string(),
            urls: Vec::new(),
            tags: Vec::new(),
            cover_image: None,
            playlists: vec![
                Playlist {
                    name: "other".to_string(),
                    tracks: Vec::new(),
                },
                Playlist {
                    name: "main".to_string(),
                    tracks: vec![Track {
                        title: "T1".to_string(),
                        file: "t1.mp3".to_string(),
                        start: None,
                        end: None,
                    }],
                },
            ],
            default_playlist: Some("main".to_string()),
            created_at: None,
        };
        let pl = get_default_playlist(&meta).unwrap();
        assert_eq!(pl.name, "main");
    }

    #[test]
    fn test_get_default_playlist_falls_back_to_first() {
        let meta = MetaFile {
            id: "test".to_string(),
            title: "Test".to_string(),
            urls: Vec::new(),
            tags: Vec::new(),
            cover_image: None,
            playlists: vec![
                Playlist {
                    name: "first".to_string(),
                    tracks: Vec::new(),
                },
                Playlist {
                    name: "second".to_string(),
                    tracks: Vec::new(),
                },
            ],
            default_playlist: None,
            created_at: None,
        };
        let pl = get_default_playlist(&meta).unwrap();
        assert_eq!(pl.name, "first");
    }

    #[test]
    fn test_get_default_playlist_empty() {
        let meta = MetaFile {
            id: "test".to_string(),
            title: "Test".to_string(),
            urls: Vec::new(),
            tags: Vec::new(),
            cover_image: None,
            playlists: Vec::new(),
            default_playlist: None,
            created_at: None,
        };
        assert!(get_default_playlist(&meta).is_none());
    }

    // --- find_work_root tests ---

    #[test]
    fn test_find_work_root_direct_child() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let work_dir = root.join("work1");
        std::fs::create_dir(&work_dir).unwrap();

        let result = find_work_root(&work_dir, root);
        assert_eq!(result, work_dir);
    }

    #[test]
    fn test_find_work_root_nested() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let work_dir = root.join("work1");
        let sub_dir = work_dir.join("audio");
        std::fs::create_dir_all(&sub_dir).unwrap();

        // Audio is in work1/audio, work root should be work1
        let result = find_work_root(&sub_dir, root);
        assert_eq!(result, work_dir);
    }

    #[test]
    fn test_find_work_root_deeply_nested() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let deep = root.join("a").join("b").join("c");
        std::fs::create_dir_all(&deep).unwrap();

        let result = find_work_root(&deep, root);
        // Should return the first child of root: "a"
        assert_eq!(result, root.join("a"));
    }

    // --- find_cover_image tests ---

    #[test]
    fn test_find_cover_image_prefers_cover_named() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("art.jpg"), "fake").unwrap();
        std::fs::write(root.join("cover.png"), "fake").unwrap();

        let result = find_cover_image(root);
        assert_eq!(result, Some("cover.png".to_string()));
    }

    #[test]
    fn test_find_cover_image_prefers_jacket_named() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("image.jpg"), "fake").unwrap();
        std::fs::write(root.join("jacket.jpg"), "fake").unwrap();

        let result = find_cover_image(root);
        assert_eq!(result, Some("jacket.jpg".to_string()));
    }

    #[test]
    fn test_find_cover_image_falls_back_to_first() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("b_image.png"), "fake").unwrap();
        std::fs::write(root.join("a_image.jpg"), "fake").unwrap();

        let result = find_cover_image(root);
        // Sorted alphabetically, a_image.jpg comes first
        assert_eq!(result, Some("a_image.jpg".to_string()));
    }

    #[test]
    fn test_find_cover_image_no_images() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("readme.txt"), "text").unwrap();

        let result = find_cover_image(root);
        assert!(result.is_none());
    }

    #[test]
    fn test_find_cover_image_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        let result = find_cover_image(dir.path());
        assert!(result.is_none());
    }

    // --- build_default_tracks tests ---

    #[test]
    fn test_build_default_tracks_direct_audio() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("track02.mp3"), "fake").unwrap();
        std::fs::write(root.join("track01.mp3"), "fake").unwrap();
        std::fs::write(root.join("track10.mp3"), "fake").unwrap();

        let tracks = build_default_tracks(root);
        assert_eq!(tracks.len(), 3);
        // Should be naturally sorted
        assert_eq!(tracks[0].file, "track01.mp3");
        assert_eq!(tracks[1].file, "track02.mp3");
        assert_eq!(tracks[2].file, "track10.mp3");
        assert_eq!(tracks[0].title, "track01");
    }

    #[test]
    fn test_build_default_tracks_empty_dir() {
        let dir = tempfile::tempdir().unwrap();
        let tracks = build_default_tracks(dir.path());
        assert!(tracks.is_empty());
    }

    #[test]
    fn test_build_default_tracks_non_audio_ignored() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join("readme.txt"), "text").unwrap();
        std::fs::write(root.join("cover.jpg"), "image").unwrap();

        let tracks = build_default_tracks(root);
        assert!(tracks.is_empty());
    }

    #[test]
    fn test_build_default_tracks_subfolder_audio() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let sub = root.join("audio");
        std::fs::create_dir(&sub).unwrap();
        std::fs::write(sub.join("track1.flac"), "fake").unwrap();
        std::fs::write(sub.join("track2.flac"), "fake").unwrap();
        // No direct audio in root

        let tracks = build_default_tracks(root);
        assert_eq!(tracks.len(), 2);
        // Relative paths should include the subfolder
        assert!(tracks[0].file.contains("audio"));
    }
}
