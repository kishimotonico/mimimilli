/**
 * 後方互換バレル — Phase 1 で API を各 feature / entity へ分散させた。
 * 既存の `import * as api from "../api"` はここを向いたままでよく、
 * 各ファイルが Phase 2-4 で feature 配下へ移動する際に import を追従させる。
 *
 * 新規コードはここではなく以下を直接 import すること:
 *   entities/work/api       — getWork, getAllWorks, updateWorkTags, updateWorkTitle, getAllTags,
 *                             getCoverImageUrl, getAudioUrl, toggleBookmark, updateLastPlayed,
 *                             saveResumePosition, listWorkFiles, fetchDlsiteInfo, applyDlsiteInfo
 *   features/library/api    — searchWorks, searchWorksV2, getAxisFacets, listSmartFolders,
 *                             createSmartFolder, updateSmartFolder, deleteSmartFolder, evalSmartFolder,
 *                             saveSearchPreset, getSearchPresets, deleteSearchPreset, exportLibrary
 *   features/scan/api       — scanLibrary
 *   features/settings/api   — getSettings, setRootFolder, getRootFolder, getLastScanTime
 */

export * from "./entities/work/api";
export * from "./features/library/api";
export * from "./features/scan/api";
export * from "./features/settings/api";
