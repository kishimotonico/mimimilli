// App: アプリ全体のオーケストレーション。
// - 設定・スキャン・フォルダー変更を TanStack Query で管理
// - player フックを保持し、library / player UI に props を流す
// - レイアウトは AppShell に委譲

import { useState, useCallback, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "../features/player/model/usePlayer";
import { playerUiModeAtom } from "../features/player/model/atoms";
import { useLibraryView } from "../features/library/model/useLibraryNavigation";
import { useGlobalShortcuts } from "./model/useGlobalShortcuts";
import AppShell from "./AppShell";
import TopBar from "./ui/TopBar";
import LeftNav from "./ui/LeftNav";
import AddressBar from "./ui/AddressBar";
import LibraryView from "../features/library/ui/LibraryView";
import { WORK_QUERY_KEYS } from "../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../entities/smart-folder/queryKeys";
import { SETTINGS_QUERY_KEYS } from "../entities/settings/queryKeys";
import FilesView from "../features/files/ui/FilesView";
import { useFilesNavigation } from "../features/files/model/useFilesNavigation";
import type { FsEntry } from "../features/files/model/types";
import PlayerDock from "../features/player/ui/PlayerDock";
import FullScreenPlayer from "../features/player/ui/FullScreenPlayer";
import SetupScreen from "../features/setup/ui/SetupScreen";
import SettingsModal from "../features/settings/ui/SettingsModal";
import NewWorkPopup from "../features/scan/ui/NewWorkPopup";
import RjCodeMissingModal from "../features/library/ui/RjCodeMissingModal";
import DlsiteFetchFailedModal from "../features/library/ui/DlsiteFetchFailedModal";
import Toast from "../shared/ui/Toast";
import type { ScanResult, Work, WorkSummary } from "@mimimilli/shared";
import { getWork } from "../entities/work/api";
import { exportLibrary } from "../features/library/api";
import { scanLibrary } from "../features/scan/api";
import { formatScanProgressLabel, shouldShowNewWorkPopup } from "../features/scan/model";
import { useScanProgress } from "../features/scan/useScanProgress";
import { useDlsiteBulk } from "./model/useDlsiteBulk";
import { useRjCodeMissingWorks } from "../features/library/model/dlsiteMissingRjCode";
import { useDlsiteFetchFailedWorks } from "../features/library/model/dlsiteFetchFailed";
import { useDlsiteUnlinkedCount } from "../features/library/model/dlsiteUnlinked";
import { getSettings, setRootFolder } from "../features/settings/api";
import { parseNavigationUrl, type AppMode } from "../features/navigation/model/navigationUrl";
import { useNavigationHistory } from "../features/navigation/model/useNavigationHistory";
import {
  libraryGridLayoutModeAtom,
  libraryTileSizeAtom,
  libraryViewModeAtom,
} from "../features/library/model/atoms";
import { clampTileSize } from "../features/library/model/gridSizing";

export default function App() {
  const player = usePlayer();
  const libraryNav = useLibraryView();
  const queryClient = useQueryClient();
  const playRequestIdRef = useRef(0);
  const [libraryViewMode, setLibraryViewMode] = useAtom(libraryViewModeAtom);
  const [libraryTileSize, setLibraryTileSize] = useAtom(libraryTileSizeAtom);
  const [libraryGridLayoutMode, setLibraryGridLayoutMode] = useAtom(libraryGridLayoutModeAtom);

  const [mode, setMode] = useState<AppMode>(
    () => parseNavigationUrl(window.location.href).state.mode,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isCompletingSetup, setIsCompletingSetup] = useState(false);
  const [showRjCodeMissing, setShowRjCodeMissing] = useState(false);
  const [showDlsiteFetchFailed, setShowDlsiteFetchFailed] = useState(false);

  const isPlaying = player.state.currentTrackIndex >= 0 && player.state.currentWork !== null;
  const isPlaybackActive = player.state.isPlaying;
  // バー表示中のみコンテンツ側に padding-bottom を確保する（ポップアップは小さく被りが少ないため対象外）
  const uiMode = useAtomValue(playerUiModeAtom);
  const dockedBarActive = isPlaying && uiMode === "bar";

  // ── キーボードショートカット ───────────────────────────────
  useGlobalShortcuts({
    onTogglePlay: player.togglePlay,
    onSeekRelative: player.seekRelative,
    isActive: isPlaying,
  });

  // ── Settings ─────────────────────────────────────────────
  const settingsQuery = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.all(),
    queryFn: getSettings,
    retry: 1,
  });
  const settings = settingsQuery.data;
  const isSetupDone: boolean | null = settingsQuery.isPending
    ? null
    : settings?.rootFolder != null
      ? true
      : settingsQuery.isError
        ? false
        : false;

  // ファイルモードのナビゲーション（フックは早期 return 前に呼ぶ）。
  const rootFolder = settings?.rootFolder ?? "/";
  const filesNav = useFilesNavigation(rootFolder);
  const navigationHistory = useNavigationHistory({
    mode,
    setMode,
    rootFolder: settings?.rootFolder ?? null,
  });

  // ── DLsite一括取得（設定モーダル・TopBar共有、TASK-41） ────────
  const dlsiteBulk = useDlsiteBulk();
  const dlsiteRjMissing = useRjCodeMissingWorks();
  const dlsiteFetchFailed = useDlsiteFetchFailedWorks();
  const dlsiteUnlinked = useDlsiteUnlinkedCount();

  // ── Scan mutation ─────────────────────────────────────────
  const scanMutation = useMutation({
    mutationFn: scanLibrary,
    onSuccess: (result) => {
      setScanResult(result);
      queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() });
      queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allFacets() });
      queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
      // スキャンで新規作品が見つかった場合、サーバーは自動でDLsite一括取得ジョブを
      // キューイングする（server/src/routes/scan.ts）。ここではAPIを呼ばずSSEに相乗りするだけ。
      if (result.newWorkIds.length > 0) dlsiteBulk.attach();
    },
  });

  // ── Change folder mutation ────────────────────────────────
  const changeFolderMutation = useMutation({
    mutationFn: setRootFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
    },
  });

  // ── Play handler ──────────────────────────────────────────
  const handlePlay = useCallback(
    async (work: WorkSummary, trackIndex: number) => {
      // ファイル欠損・メタ読み込みエラーの作品は再生できない（UI側の無効化が第一線、これは防衛線）。
      if (work.status !== "ok") return;
      const requestId = ++playRequestIdRef.current;
      try {
        const cached = queryClient.getQueryData<Awaited<ReturnType<typeof getWork>>>(
          WORK_QUERY_KEYS.detail(work.id),
        );
        const fullWork = cached ?? (await getWork(work.id));
        if (requestId !== playRequestIdRef.current) return;
        const playlist =
          fullWork.playlists.find((p) => p.id === fullWork.defaultPlaylistId) ??
          fullWork.playlists[0];
        const tracks = playlist?.tracks ?? [];
        if (tracks.length > 0) {
          player.play(work, tracks, Math.min(trackIndex, tracks.length - 1), playlist!.id);
        }
      } catch (err) {
        console.error("作品の再生に失敗しました", err);
      }
    },
    [player, queryClient],
  );

  const handleResume = useCallback(
    (work: Work) => {
      if (work.status !== "ok") return;
      ++playRequestIdRef.current;
      player.playWithResume(work);
    },
    [player],
  );

  // ファイルモード: 作品配下の音声ファイルを単一トラックとして常駐プレイヤーで再生する。
  // 作品の外にあるファイル（workId/workRelPath なし）は既存メディア配信で扱えないため再生しない。
  const handlePlayFile = useCallback(
    async (entry: FsEntry) => {
      if (!entry.workId || !entry.workRelPath) return;
      const requestId = ++playRequestIdRef.current;
      try {
        const cached = queryClient.getQueryData<Awaited<ReturnType<typeof getWork>>>(
          WORK_QUERY_KEYS.detail(entry.workId),
        );
        const fullWork = cached ?? (await getWork(entry.workId));
        if (requestId !== playRequestIdRef.current) return;
        // ファイル欠損・メタ読み込みエラーの作品配下のファイルは再生できない。
        if (fullWork.status !== "ok") return;
        player.play(
          fullWork,
          [{ id: crypto.randomUUID(), title: entry.name, file: entry.workRelPath }],
          0,
        );
      } catch (err) {
        console.error("ファイルの再生に失敗しました", err);
      }
    },
    [player, queryClient],
  );

  // 再生中の作品をライブラリ「すべての作品」上で選択状態にして表示する。
  // ファイル欠損等で登録から外れた作品の場合、該当なしになるが実害はない。
  const handleShowPlayingWork = useCallback(() => {
    const workId = player.state.currentWork?.id;
    if (!workId) return;
    navigationHistory.setMode("library");
    libraryNav.setAxis("all");
    libraryNav.selectWork(workId);
  }, [player.state.currentWork, navigationHistory, libraryNav]);

  const handleScan = useCallback(() => scanMutation.mutate(), [scanMutation]);

  // 通知ベルの一覧（RJコード未検出・DLsite取得失敗）から作品を選び、
  // 作品詳細（DlsitePanel）へ遷移する。
  const handleOpenWorkFromNotification = useCallback(
    (workId: string) => {
      setShowRjCodeMissing(false);
      setShowDlsiteFetchFailed(false);
      setScanResult(null);
      navigationHistory.setMode("library");
      libraryNav.setAxis("all");
      libraryNav.selectWork(workId);
    },
    [navigationHistory, libraryNav],
  );

  // スキャン進捗のリアルタイム表示（TASK-20）。TopBar / SettingsModal / SetupScreen で共有する。
  const scanProgress = useScanProgress(scanMutation.isPending || isCompletingSetup);
  const scanProgressLabel = formatScanProgressLabel(scanProgress);

  const handleSetupComplete = useCallback(
    async (path: string) => {
      setIsCompletingSetup(true);
      try {
        await setRootFolder(path);
        queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
        const result = await scanLibrary();
        setScanResult(result);
        queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() });
        queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allFacets() });
        queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() });
        queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), (prev: typeof settings) =>
          prev ? { ...prev, rootFolder: path } : prev,
        );
      } finally {
        setIsCompletingSetup(false);
      }
    },
    [queryClient],
  );

  const handleChangeFolder = useCallback(
    (path: string) => changeFolderMutation.mutate(path),
    [changeFolderMutation],
  );

  const handleExport = useCallback(async () => {
    try {
      const data = await exportLibrary();
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mimimilli-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, []);

  // ── ローディング ──────────────────────────────────────────
  if (isSetupDone === null) {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: "var(--paper-0)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontFamily: "var(--font-jp)", fontSize: 13, color: "var(--ink-4)" }}>
          読み込み中...
        </span>
      </div>
    );
  }

  if (!isSetupDone) {
    return (
      <SetupScreen
        onComplete={handleSetupComplete}
        scanning={isCompletingSetup}
        scanProgressLabel={scanProgressLabel}
      />
    );
  }

  const currentTrack = isPlaying ? player.state.tracks[player.state.currentTrackIndex] : null;
  const playingRelPath = currentTrack?.file ?? null;

  return (
    <AppShell
      dockedBarActive={dockedBarActive}
      topBar={
        <TopBar
          mode={mode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onScan={handleScan}
          onSettings={() => setShowSettings(true)}
          isPlaying={isPlaying}
          playingTrack={currentTrack?.title}
          scanning={scanMutation.isPending}
          scanProgressLabel={scanProgressLabel}
          rjCodeMissingCount={dlsiteRjMissing.count}
          onOpenRjCodeMissing={() => setShowRjCodeMissing(true)}
          dlsiteFetchFailedCount={dlsiteFetchFailed.count}
          onOpenDlsiteFetchFailed={() => setShowDlsiteFetchFailed(true)}
          dlsiteUnlinkedCount={dlsiteUnlinked.count}
          dlsiteBulkActive={dlsiteBulk.active}
          dlsiteBulkProgress={dlsiteBulk.progress}
          onStartDlsiteBulk={dlsiteBulk.start}
          scanResult={scanResult}
        />
      }
      addressBar={
        <AddressBar
          path={mode === "files" ? filesNav.addressPath : libraryNav.addressPath}
          onNavigate={mode === "files" ? filesNav.goToSegment : libraryNav.goToSegment}
          onBack={navigationHistory.back}
          onForward={navigationHistory.forward}
          canBack={navigationHistory.canBack}
          canForward={navigationHistory.canForward}
          showSort={mode === "library"}
          sort={libraryNav.sort}
          onSortChange={libraryNav.setSort}
          viewMode={mode === "library" ? libraryViewMode : "column"}
          availableViewModes={mode === "library" ? ["list", "grid"] : ["column"]}
          onViewChange={(viewMode) => {
            if (mode === "library" && viewMode !== "column") setLibraryViewMode(viewMode);
          }}
          tileSize={mode === "library" ? clampTileSize(libraryTileSize) : undefined}
          onTileSizeChange={mode === "library" ? setLibraryTileSize : undefined}
          gridLayoutMode={mode === "library" ? libraryGridLayoutMode : undefined}
          onGridLayoutModeChange={mode === "library" ? setLibraryGridLayoutMode : undefined}
        />
      }
      leftNav={
        <LeftNav
          mode={mode}
          onModeChange={navigationHistory.setMode}
          playingCount={isPlaying ? 1 : 0}
        />
      }
      body={
        mode === "files" ? (
          <FilesView
            rootFolder={rootFolder}
            playingWorkId={player.state.currentWork?.id}
            playingRelPath={playingRelPath}
            isPlaybackActive={isPlaybackActive}
            onPlayFile={handlePlayFile}
          />
        ) : (
          <LibraryView
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            playingWorkId={player.state.currentWork?.id}
            playingTrackIndex={player.state.currentTrackIndex}
            isPlaybackActive={isPlaybackActive}
            onPlay={handlePlay}
            onResume={handleResume}
            viewMode={libraryViewMode}
            tileSize={clampTileSize(libraryTileSize)}
            onTileSizeChange={setLibraryTileSize}
            gridLayoutMode={libraryGridLayoutMode}
          />
        )
      }
      transportBar={
        <PlayerDock
          isPlaying={isPlaying}
          state={player.state}
          onTogglePlay={player.togglePlay}
          onSeek={player.seek}
          onSeekRelative={player.seekRelative}
          onSetVolume={player.setVolume}
          onToggleMute={player.toggleMute}
          onSetLoop={player.setLoop}
          onSetPlaybackRate={player.setPlaybackRate}
          onNext={player.nextTrack}
          onPrev={player.prevTrack}
          onExpandFullScreen={() => player.setShowFullPlayer(true)}
          onShowPlayingWork={handleShowPlayingWork}
        />
      }
      fullScreenPlayer={
        isPlaying && player.state.showFullPlayer ? (
          <FullScreenPlayer
            state={player.state}
            onTogglePlay={player.togglePlay}
            onSeek={player.seek}
            onSeekRelative={player.seekRelative}
            onSetVolume={player.setVolume}
            onSetLoop={player.setLoop}
            onNext={player.nextTrack}
            onPrev={player.prevTrack}
            onSelectTrack={player.setTrackIndex}
            onClose={() => player.setShowFullPlayer(false)}
            onSetChannelSwap={player.setChannelSwap}
            onSetABPoint={player.setABPoint}
            onClearABRepeat={player.clearABRepeat}
          />
        ) : undefined
      }
      overlays={
        <>
          {showSettings && (
            <SettingsModal
              rootFolder={settings?.rootFolder ?? null}
              lastScanTime={settings?.lastScanTime ?? null}
              scanning={scanMutation.isPending}
              scanProgressLabel={scanProgressLabel}
              dlsiteBulk={{
                active: dlsiteBulk.active,
                progress: dlsiteBulk.progress,
                onStart: dlsiteBulk.start,
              }}
              onClose={() => setShowSettings(false)}
              onScan={handleScan}
              onChangeFolder={handleChangeFolder}
              onExport={handleExport}
            />
          )}
          {shouldShowNewWorkPopup(scanResult) && (
            <NewWorkPopup
              scanResult={scanResult}
              onClose={() => setScanResult(null)}
              onOpenRjCodeMissing={() => {
                setScanResult(null);
                setShowRjCodeMissing(true);
              }}
            />
          )}
          {showRjCodeMissing && (
            <RjCodeMissingModal
              onClose={() => setShowRjCodeMissing(false)}
              onOpenWork={handleOpenWorkFromNotification}
            />
          )}
          {showDlsiteFetchFailed && (
            <DlsiteFetchFailedModal
              onClose={() => setShowDlsiteFetchFailed(false)}
              onOpenWork={handleOpenWorkFromNotification}
            />
          )}
          <Toast
            message={
              dlsiteBulk.result
                ? `DLsite一括取得: 取得 ${dlsiteBulk.result.fetched}件・失敗 ${dlsiteBulk.result.failed}件`
                : dlsiteBulk.error
            }
            onDismiss={dlsiteBulk.dismiss}
          />
        </>
      }
    />
  );
}
