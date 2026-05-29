mod db;
mod dlsite;
mod handlers;
mod models;
mod scanner;
mod service;

use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tower_http::cors::CorsLayer;

use service::AppService;

#[tokio::main]
async fn main() {
    env_logger::init();

    let data_dir =
        PathBuf::from(std::env::var("DATA_DIR").unwrap_or_else(|_| "./data".to_string()));
    let service = Arc::new(AppService::new(&data_dir).expect("Failed to initialize AppService"));

    let app = Router::new()
        // Settings
        .route("/api/settings", get(handlers::settings::get_settings))
        .route("/api/settings", post(handlers::settings::set_settings))
        // Library – scan & export
        .route("/api/scan", post(handlers::library::scan))
        .route("/api/export", post(handlers::library::export))
        // Works
        .route("/api/works", get(handlers::library::get_works))
        .route("/api/works/:id", get(handlers::library::get_work))
        .route("/api/works/:id/tags", put(handlers::library::update_tags))
        .route("/api/works/:id/title", put(handlers::library::update_title))
        .route(
            "/api/works/:id/bookmark",
            post(handlers::library::toggle_bookmark),
        )
        .route(
            "/api/works/:id/last-played",
            post(handlers::library::update_last_played),
        )
        .route(
            "/api/works/:id/resume",
            post(handlers::library::save_resume),
        )
        .route("/api/works/:id/files", get(handlers::library::list_files))
        // Tags & presets
        .route("/api/tags", get(handlers::library::get_tags))
        .route(
            "/api/library/axes/:axis",
            get(handlers::library::get_axis_facets),
        )
        .route(
            "/api/library/smart-folders",
            get(handlers::library::list_smart_folders),
        )
        .route(
            "/api/library/smart-folders",
            post(handlers::library::create_smart_folder),
        )
        .route(
            "/api/library/smart-folders/:id",
            get(handlers::library::get_smart_folder),
        )
        .route(
            "/api/library/smart-folders/:id",
            put(handlers::library::update_smart_folder),
        )
        .route(
            "/api/library/smart-folders/:id",
            delete(handlers::library::delete_smart_folder),
        )
        .route(
            "/api/library/smart-folders/:id/works",
            get(handlers::library::eval_smart_folder),
        )
        .route("/api/presets", get(handlers::library::get_presets))
        .route("/api/presets", post(handlers::library::save_preset))
        .route("/api/presets/:id", delete(handlers::library::delete_preset))
        // Media
        .route("/api/works/:id/cover", get(handlers::media::get_cover))
        .route("/api/audio/:id/*path", get(handlers::media::get_audio))
        .route("/api/files/:id/*path", get(handlers::media::get_file))
        // DLsite integrations
        .route(
            "/api/dlsite/:id/fetch",
            post(handlers::integrations::fetch_dlsite),
        )
        .route(
            "/api/dlsite/:id/apply",
            post(handlers::integrations::apply_dlsite),
        )
        .layer(CorsLayer::permissive())
        .with_state(service);

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let addr = SocketAddr::from(([127, 0, 0, 1], port));

    log::info!("mimikago-server listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("Failed to bind");
    axum::serve(listener, app).await.expect("Server error");
}
