use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
};
use std::{path::PathBuf, sync::Arc};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

use crate::service::AppService;

pub async fn get_cover(
    State(service): State<Arc<AppService>>,
    Path(id): Path<String>,
) -> Result<Response, StatusCode> {
    let path = service
        .get_cover_image_path(&id)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    serve_file(PathBuf::from(path), None).await
}

pub async fn get_audio(
    State(service): State<Arc<AppService>>,
    Path((id, file_path)): Path<(String, String)>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    let abs_path = service
        .get_audio_file_path(&id, &file_path)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(String::from);
    serve_file(PathBuf::from(abs_path), range).await
}

pub async fn get_file(
    State(service): State<Arc<AppService>>,
    Path((id, file_path)): Path<(String, String)>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    let abs_path = service
        .get_audio_file_path(&id, &file_path)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .map(String::from);
    serve_file(PathBuf::from(abs_path), range).await
}

async fn serve_file(path: PathBuf, range: Option<String>) -> Result<Response, StatusCode> {
    let file = tokio::fs::File::open(&path)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    let file_size = file
        .metadata()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .len();

    let content_type = mime_guess::from_path(&path)
        .first_or_octet_stream()
        .to_string();

    if let Some(range_str) = range {
        if let Some((start, end)) = parse_range(&range_str, file_size) {
            let length = end - start + 1;

            let mut file = file;
            file.seek(std::io::SeekFrom::Start(start))
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            let limited = file.take(length);
            let stream = ReaderStream::new(limited);
            let body = Body::from_stream(stream);

            return Response::builder()
                .status(StatusCode::PARTIAL_CONTENT)
                .header(header::CONTENT_TYPE, content_type)
                .header(header::CONTENT_LENGTH, length)
                .header(
                    header::CONTENT_RANGE,
                    format!("bytes {}-{}/{}", start, end, file_size),
                )
                .header(header::ACCEPT_RANGES, "bytes")
                .body(body)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR);
        }
    }

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, file_size)
        .header(header::ACCEPT_RANGES, "bytes")
        .body(body)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

fn parse_range(range_str: &str, file_size: u64) -> Option<(u64, u64)> {
    let stripped = range_str.strip_prefix("bytes=")?;
    let mut parts = stripped.splitn(2, '-');
    let start_str = parts.next()?;
    let end_str = parts.next().unwrap_or("");

    let start: u64 = if start_str.is_empty() {
        // "bytes=-N" → last N bytes
        let suffix: u64 = end_str.parse().ok()?;
        file_size.saturating_sub(suffix)
    } else {
        start_str.parse().ok()?
    };

    let end: u64 = if end_str.is_empty() {
        file_size.saturating_sub(1)
    } else {
        end_str
            .parse::<u64>()
            .ok()?
            .min(file_size.saturating_sub(1))
    };

    if start > end || start >= file_size {
        return None;
    }

    Some((start, end))
}
