use reqwest::blocking::Client;
use reqwest::header;
use scraper::{Html, Selector};
use std::time::Duration;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DlsiteWorkInfo {
    pub rj_code: String,
    pub title: String,
    pub circle: Option<String>,
    pub cvs: Vec<String>,
    pub genre_tags: Vec<String>,
    pub cover_url: Option<String>,
    pub url: String,
}

/// Extract RJ code from a folder name or string.
/// Supports RJ followed by digits (e.g., RJ01234567, RJ123456).
pub fn extract_rj_code(s: &str) -> Option<String> {
    let upper = s.to_uppercase();
    // Find RJ followed by digits
    if let Some(pos) = upper.find("RJ") {
        let rest = &upper[pos + 2..];
        let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
        if digits.len() >= 4 {
            return Some(format!("RJ{}", digits));
        }
    }
    None
}

/// Fetch work info from DLsite by RJ code.
pub fn fetch_dlsite_info(rj_code: &str) -> Result<DlsiteWorkInfo, String> {
    let url = format!(
        "https://www.dlsite.com/maniax/work/=/product_id/{}.html",
        rj_code
    );

    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Set cookie to bypass age verification
    let response = client
        .get(&url)
        .header(header::COOKIE, "adultchecked=1")
        .header(
            header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .header(header::ACCEPT_LANGUAGE, "ja")
        .send()
        .map_err(|e| format!("Failed to fetch DLsite page: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "DLsite returned status {}: {}",
            response.status(),
            rj_code
        ));
    }

    let html = response
        .text()
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    parse_dlsite_html(&html, rj_code, &url)
}

fn parse_dlsite_html(html: &str, rj_code: &str, page_url: &str) -> Result<DlsiteWorkInfo, String> {
    let document = Html::parse_document(html);

    // Title: <h1 id="work_name">...</h1>
    let title = extract_text(&document, "#work_name").unwrap_or_else(|| rj_code.to_string());

    // Circle name: <span class="maker_name"><a>...</a></span>
    let circle = extract_text(&document, "span.maker_name a");

    // Cover image: <div class="product-slider-data" data-src="...">
    // or <img srcset="..." in the product slider
    let cover_url = extract_cover_url(&document);

    // CVs: look for the row with "声優" label in the work info table
    let cvs = extract_table_links(&document, "声優");

    // Genre tags: <div class="main_genre">...</div> links
    let genre_tags = extract_genre_tags(&document);

    Ok(DlsiteWorkInfo {
        rj_code: rj_code.to_string(),
        title,
        circle,
        cvs,
        genre_tags,
        cover_url,
        url: page_url.to_string(),
    })
}

fn extract_text(document: &Html, selector_str: &str) -> Option<String> {
    let selector = Selector::parse(selector_str).ok()?;
    let element = document.select(&selector).next()?;
    let text: String = element
        .text()
        .collect::<Vec<_>>()
        .join("")
        .trim()
        .to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn extract_cover_url(document: &Html) -> Option<String> {
    // Try product-slider-data first
    if let Ok(selector) = Selector::parse("div.product-slider-data div") {
        for element in document.select(&selector) {
            if let Some(src) = element.value().attr("data-src") {
                let url = normalize_url(src);
                if url.contains("img_main") || url.contains("product") {
                    return Some(url);
                }
            }
        }
    }

    // Try the main product image
    if let Ok(selector) = Selector::parse("picture.product-slider-preview source") {
        for element in document.select(&selector) {
            if let Some(srcset) = element.value().attr("srcset") {
                // Take the first URL from srcset
                let url = srcset.split_whitespace().next().unwrap_or("");
                if !url.is_empty() {
                    return Some(normalize_url(url));
                }
            }
        }
    }

    // Fallback: look for any img with product ID in src
    if let Ok(selector) = Selector::parse("#work_left img") {
        for element in document.select(&selector) {
            if let Some(src) = element.value().attr("src") {
                return Some(normalize_url(src));
            }
        }
    }

    None
}

fn extract_table_links(document: &Html, label: &str) -> Vec<String> {
    let mut results = Vec::new();

    // DLsite work info table: <th>声優</th> followed by <td> with links
    if let Ok(th_selector) = Selector::parse("th") {
        for th in document.select(&th_selector) {
            let th_text: String = th.text().collect::<Vec<_>>().join("").trim().to_string();
            if th_text.contains(label) {
                // Get the next sibling <td>
                if let Some(parent) = th.parent() {
                    if let Ok(td_selector) = Selector::parse("td a") {
                        let parent_ref = scraper::ElementRef::wrap(parent);
                        if let Some(parent_el) = parent_ref {
                            for a in parent_el.select(&td_selector) {
                                let text: String =
                                    a.text().collect::<Vec<_>>().join("").trim().to_string();
                                if !text.is_empty() {
                                    results.push(text);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    results
}

fn extract_genre_tags(document: &Html) -> Vec<String> {
    let mut tags = Vec::new();

    if let Ok(selector) = Selector::parse("div.main_genre a") {
        for element in document.select(&selector) {
            let text: String = element
                .text()
                .collect::<Vec<_>>()
                .join("")
                .trim()
                .to_string();
            if !text.is_empty() {
                tags.push(text);
            }
        }
    }

    tags
}

fn normalize_url(url: &str) -> String {
    if url.starts_with("//") {
        format!("https:{}", url)
    } else if url.starts_with('/') {
        format!("https://www.dlsite.com{}", url)
    } else {
        url.to_string()
    }
}

/// Download a cover image from a URL and save it to the work directory.
pub fn download_cover_image(url: &str, save_path: &std::path::Path) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(url)
        .header(header::COOKIE, "adultchecked=1")
        .header(
            header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .header(header::REFERER, "https://www.dlsite.com/")
        .send()
        .map_err(|e| format!("Failed to download image: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Image download failed: status {}",
            response.status()
        ));
    }

    // Determine file extension from URL or content-type
    let ext = url
        .rsplit('.')
        .next()
        .and_then(|e| {
            let e = e.split('?').next().unwrap_or(e).to_lowercase();
            match e.as_str() {
                "jpg" | "jpeg" | "png" | "gif" | "webp" => Some(e),
                _ => None,
            }
        })
        .unwrap_or_else(|| "jpg".to_string());

    let filename = format!("cover_dlsite.{}", ext);
    let file_path = save_path.join(&filename);

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to read image bytes: {}", e))?;

    std::fs::write(&file_path, &bytes).map_err(|e| format!("Failed to save image: {}", e))?;

    Ok(filename)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_rj_code() {
        assert_eq!(
            extract_rj_code("RJ01234567"),
            Some("RJ01234567".to_string())
        );
        assert_eq!(extract_rj_code("RJ123456"), Some("RJ123456".to_string()));
        assert_eq!(
            extract_rj_code("[RJ01234567] 作品タイトル"),
            Some("RJ01234567".to_string())
        );
        assert_eq!(extract_rj_code("作品フォルダー"), None);
        assert_eq!(
            extract_rj_code("rj01234567_タイトル"),
            Some("RJ01234567".to_string())
        );
    }

    #[test]
    fn test_extract_rj_code_empty_string() {
        assert_eq!(extract_rj_code(""), None);
    }

    #[test]
    fn test_extract_rj_code_only_rj() {
        assert_eq!(extract_rj_code("RJ"), None);
    }

    #[test]
    fn test_extract_rj_code_short_digits() {
        // Less than 4 digits should be rejected
        assert_eq!(extract_rj_code("RJ12"), None);
        assert_eq!(extract_rj_code("RJ123"), None);
    }

    #[test]
    fn test_extract_rj_code_exactly_four_digits() {
        assert_eq!(extract_rj_code("RJ1234"), Some("RJ1234".to_string()));
    }

    #[test]
    fn test_extract_rj_code_mixed_case() {
        assert_eq!(
            extract_rj_code("Rj01234567"),
            Some("RJ01234567".to_string())
        );
    }

    #[test]
    fn test_extract_rj_code_rj_in_middle() {
        assert_eq!(
            extract_rj_code("some_prefix_RJ99999999_suffix"),
            Some("RJ99999999".to_string())
        );
    }

    #[test]
    fn test_normalize_url_protocol_relative() {
        assert_eq!(
            normalize_url("//img.dlsite.com/image.jpg"),
            "https://img.dlsite.com/image.jpg"
        );
    }

    #[test]
    fn test_normalize_url_absolute_path() {
        assert_eq!(
            normalize_url("/maniax/work/image.jpg"),
            "https://www.dlsite.com/maniax/work/image.jpg"
        );
    }

    #[test]
    fn test_normalize_url_full_url() {
        assert_eq!(
            normalize_url("https://example.com/image.jpg"),
            "https://example.com/image.jpg"
        );
    }

    #[test]
    fn test_normalize_url_empty() {
        assert_eq!(normalize_url(""), "");
    }

    #[test]
    fn test_parse_dlsite_html_basic() {
        let html = r##"
            <html><body>
            <h1 id="work_name">テスト作品タイトル</h1>
            <span class="maker_name"><a href="#">テストサークル</a></span>
            <div class="main_genre"><a href="#">ASMR</a><a href="#">癒し</a></div>
            </body></html>
        "##;

        let result = parse_dlsite_html(html, "RJ01234567", "https://www.dlsite.com/test").unwrap();
        assert_eq!(result.rj_code, "RJ01234567");
        assert_eq!(result.title, "テスト作品タイトル");
        assert_eq!(result.circle, Some("テストサークル".to_string()));
        assert_eq!(result.genre_tags, vec!["ASMR", "癒し"]);
        assert_eq!(result.url, "https://www.dlsite.com/test");
    }

    #[test]
    fn test_parse_dlsite_html_missing_title() {
        let html = r##"<html><body></body></html>"##;
        let result = parse_dlsite_html(html, "RJ01234567", "https://example.com").unwrap();
        // Falls back to rj_code when title not found
        assert_eq!(result.title, "RJ01234567");
    }

    #[test]
    fn test_parse_dlsite_html_no_circle() {
        let html = r##"
            <html><body>
            <h1 id="work_name">タイトル</h1>
            </body></html>
        "##;
        let result = parse_dlsite_html(html, "RJ01234567", "https://example.com").unwrap();
        assert_eq!(result.circle, None);
        assert!(result.genre_tags.is_empty());
    }

    #[test]
    fn test_parse_dlsite_html_cover_url_from_slider() {
        let html = r##"
            <html><body>
            <h1 id="work_name">タイトル</h1>
            <div class="product-slider-data">
                <div data-src="//img.dlsite.com/img_main/product.jpg"></div>
            </div>
            </body></html>
        "##;
        let result = parse_dlsite_html(html, "RJ01234567", "https://example.com").unwrap();
        assert_eq!(
            result.cover_url,
            Some("https://img.dlsite.com/img_main/product.jpg".to_string())
        );
    }

    #[test]
    fn test_parse_dlsite_html_cvs_from_table() {
        let html = r##"
            <html><body>
            <h1 id="work_name">タイトル</h1>
            <table>
                <tr>
                    <th>声優</th>
                    <td><a href="#">声優A</a><a href="#">声優B</a></td>
                </tr>
            </table>
            </body></html>
        "##;
        let result = parse_dlsite_html(html, "RJ01234567", "https://example.com").unwrap();
        assert_eq!(result.cvs, vec!["声優A", "声優B"]);
    }
}
