use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

use crate::dlsite::DlsiteWorkInfo;
use crate::service::AppService;

pub async fn fetch_dlsite(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
) -> Result<Json<DlsiteWorkInfo>, (StatusCode, String)> {
    let result = tokio::task::spawn_blocking(move || service.fetch_dlsite_info(&id))
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
    Ok(Json(result))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyDlsiteRequest {
    info: DlsiteWorkInfo,
    apply_title: bool,
    apply_tags: bool,
    apply_cover: bool,
}

pub async fn apply_dlsite(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
    Json(body): Json<ApplyDlsiteRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let info = body.info;
    let apply_title = body.apply_title;
    let apply_tags = body.apply_tags;
    let apply_cover = body.apply_cover;

    tokio::task::spawn_blocking(move || {
        service.apply_dlsite_info(&id, &info, apply_title, apply_tags, apply_cover)
    })
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    Ok(StatusCode::NO_CONTENT)
}
