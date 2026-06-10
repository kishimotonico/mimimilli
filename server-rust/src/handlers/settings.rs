use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::service::AppService;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsResponse {
    root_folder: Option<String>,
    last_scan_time: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetSettingsRequest {
    root_folder: Option<String>,
}

pub async fn get_settings(
    State(service): State<Arc<AppService>>,
) -> Result<Json<SettingsResponse>, (StatusCode, String)> {
    let root_folder = service
        .get_root_folder()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    let last_scan_time = service
        .get_last_scan_time()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;
    Ok(Json(SettingsResponse {
        root_folder,
        last_scan_time,
    }))
}

pub async fn set_settings(
    State(service): State<Arc<AppService>>,
    Json(body): Json<SetSettingsRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    if let Some(path) = body.root_folder {
        service
            .set_root_folder(&path)
            .map_err(|e| (StatusCode::BAD_REQUEST, e))?;
    }
    Ok(StatusCode::NO_CONTENT)
}
