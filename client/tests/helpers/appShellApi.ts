import { apiNoContent, type ApiRoutes } from "./api";
import {
  buildDlsiteNotificationSummary,
  buildScanDiagnostics,
  buildSettings,
  buildWorksPage,
} from "./builders";

/** 空のライブラリでアプリ全体を描画したときに最初に呼ばれる読み取り系 API の既定応答 */
export function appShellRoutes(overrides: ApiRoutes = {}): ApiRoutes {
  return {
    "GET /api/settings": buildSettings(),
    "GET /api/scan/active": () => apiNoContent(),
    "GET /api/scan/last": () => apiNoContent(),
    "GET /api/scan/candidates": { candidates: [] },
    "GET /api/scan/candidates/exclusions": { paths: [] },
    "GET /api/scan/diagnostics": buildScanDiagnostics(),
    "GET /api/dlsite/notifications": buildDlsiteNotificationSummary(),
    "GET /api/dlsite/bulk": { current: null, lastTerminal: null },
    "GET /api/works": buildWorksPage(),
    "GET /api/tags": [],
    "GET /api/tag-prefixes": [],
    "GET /api/tag-prefixes/candidates": [],
    "GET /api/smart-folders": [],
    "GET /api/axes/:axis": [],
    ...overrides,
  };
}
