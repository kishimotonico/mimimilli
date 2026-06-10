use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::models::{
    AxisFacetItem, FileEntry, ScanResult, SearchPreset, SmartFolder, Work, WorkSummary,
};
use crate::service::AppService;

fn library_error_status(error: &str) -> StatusCode {
    if error.starts_with("Invalid axis:") {
        StatusCode::BAD_REQUEST
    } else if error.contains("not found") {
        StatusCode::NOT_FOUND
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}

pub async fn scan(
    State(service): State<Arc<AppService>>,
) -> Result<Json<ScanResult>, (StatusCode, String)> {
    let result = service
        .scan()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(result))
}

#[derive(Deserialize)]
pub struct WorksQuery {
    q: Option<String>,
    tags: Option<String>,
    axis: Option<String>,
    axis_value: Option<String>,
    tag_op: Option<String>,
    sort: Option<String>,
    view: Option<String>,
}

pub async fn get_works(
    State(service): State<Arc<AppService>>,
    Query(params): Query<WorksQuery>,
) -> Result<Json<Vec<WorkSummary>>, (StatusCode, String)> {
    let works = if params.q.is_some() || params.tags.is_some() {
        let query = params.q.as_deref().unwrap_or("");
        let tag_filters: Vec<String> = params
            .tags
            .as_deref()
            .map(|t| {
                t.split(',')
                    .map(String::from)
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default();
        service
            .search_works_filtered(
                query,
                &tag_filters,
                params.axis.as_deref(),
                params.axis_value.as_deref(),
                params.tag_op.as_deref(),
                params.sort.as_deref(),
                params.view.as_deref(),
            )
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?
    } else {
        service
            .get_all_works_filtered(
                params.axis.as_deref(),
                params.axis_value.as_deref(),
                params.sort.as_deref(),
                params.view.as_deref(),
            )
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?
    };
    Ok(Json(works))
}

pub async fn get_work(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
) -> Result<Json<Option<Work>>, (StatusCode, String)> {
    let work = service
        .get_work(&id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(work))
}

#[derive(Deserialize)]
pub struct UpdateTagsRequest {
    tags: Vec<String>,
}

pub async fn update_tags(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTagsRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    service
        .update_work_tags(&id, body.tags)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct UpdateTitleRequest {
    title: String,
}

pub async fn update_title(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTitleRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    service
        .update_work_title(&id, &body.title)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct BookmarkResponse {
    bookmarked: bool,
}

pub async fn toggle_bookmark(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
) -> Result<Json<BookmarkResponse>, (StatusCode, String)> {
    let bookmarked = service
        .toggle_bookmark(&id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(BookmarkResponse { bookmarked }))
}

pub async fn update_last_played(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    service
        .update_last_played(&id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResumeRequest {
    position: f64,
    track_index: i32,
}

pub async fn save_resume(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
    Json(body): Json<SaveResumeRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    service
        .save_resume_position(&id, body.position, body.track_index)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_files(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
) -> Result<Json<Option<FileEntry>>, (StatusCode, String)> {
    let entry = service
        .list_work_files(&id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(entry))
}

pub async fn get_tags(
    State(service): State<Arc<AppService>>,
) -> Result<Json<Vec<String>>, (StatusCode, String)> {
    let tags = service
        .get_all_tags()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(tags))
}

pub async fn get_axis_facets(
    State(service): State<Arc<AppService>>,
    Path(axis): Path<String>,
) -> Result<Json<Vec<AxisFacetItem>>, (StatusCode, String)> {
    let facets = service
        .get_axis_facets(&axis)
        .map_err(|e| (library_error_status(&e), e))?;
    Ok(Json(facets))
}

pub async fn list_smart_folders(
    State(service): State<Arc<AppService>>,
) -> Result<Json<Vec<SmartFolder>>, (StatusCode, String)> {
    let folders = service
        .list_smart_folders()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(folders))
}

pub async fn create_smart_folder(
    State(service): State<Arc<AppService>>,
    Json(folder): Json<SmartFolder>,
) -> Result<Json<SmartFolder>, (StatusCode, String)> {
    let folder = service
        .create_smart_folder(folder)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(folder))
}

pub async fn get_smart_folder(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
) -> Result<Json<SmartFolder>, (StatusCode, String)> {
    let folder = service
        .get_smart_folder(&id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                format!("Smart folder not found: {}", id),
            )
        })?;
    Ok(Json(folder))
}

pub async fn update_smart_folder(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
    Json(folder): Json<SmartFolder>,
) -> Result<Json<SmartFolder>, (StatusCode, String)> {
    let folder = service
        .update_smart_folder(&id, folder)
        .map_err(|e| (library_error_status(&e), e))?;
    Ok(Json(folder))
}

pub async fn delete_smart_folder(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    service
        .delete_smart_folder(&id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn eval_smart_folder(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
) -> Result<Json<Vec<Work>>, (StatusCode, String)> {
    let works = service
        .eval_smart_folder(&id)
        .map_err(|e| (library_error_status(&e), e))?;
    Ok(Json(works))
}

pub async fn get_presets(
    State(service): State<Arc<AppService>>,
) -> Result<Json<Vec<SearchPreset>>, (StatusCode, String)> {
    let presets = service
        .get_search_presets()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(presets))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavePresetRequest {
    name: String,
    query: String,
    tag_filters: Vec<String>,
    sort_id: String,
}

#[derive(Serialize)]
pub struct SavePresetResponse {
    id: i64,
}

pub async fn save_preset(
    State(service): State<Arc<AppService>>,
    Json(body): Json<SavePresetRequest>,
) -> Result<Json<SavePresetResponse>, (StatusCode, String)> {
    let id = service
        .save_search_preset(&body.name, &body.query, &body.tag_filters, &body.sort_id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(SavePresetResponse { id }))
}

pub async fn delete_preset(
    State(service): State<Arc<AppService>>,
    Path(id): Path<i64>,
) -> Result<StatusCode, (StatusCode, String)> {
    service
        .delete_search_preset(id)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct ExportResponse {
    data: String,
}

pub async fn export(
    State(service): State<Arc<AppService>>,
) -> Result<Json<ExportResponse>, (StatusCode, String)> {
    let data = service
        .export_library()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(ExportResponse { data }))
}
