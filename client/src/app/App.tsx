// App: アプリ全体のオーケストレーション。
// - 設定・スキャン・フォルダー変更を TanStack Query で管理
// - 再生開始は usePlayerActions のみ利用（state は leaf で購読）
// - レイアウトは AppShell に委譲

import { useState, useCallback, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlayerActions } from "../features/player/model/usePlayer";
import PlayerRuntime from "../features/player/ui/PlayerRuntime";
import FullScreenPlayerGate from "../features/player/ui/FullScreenPlayerGate";
import AppShell from "./AppShell";
import TopBar from "./ui/TopBar";
import LeftNav from "./ui/LeftNav";
import AddressBar from "./ui/AddressBar";
import NotificationBell from "./ui/NotificationBell";
import LibraryView from "../features/library/ui/LibraryView";
import { WORK_QUERY_KEYS } from "../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../entities/smart-folder/queryKeys";
import { SETTINGS_QUERY_KEYS } from "../entities/settings/queryKeys";
import FilesView from "../features/files/ui/FilesView";
import type { FsEntry } from "../features/files/model/types";
import PlayerDock from "../features/player/ui/PlayerDock";
import SetupScreen from "../features/setup/ui/SetupScreen";
import SettingsModal from "../features/settings/ui/SettingsModal";
import ScanModal from "../features/scan/ui/ScanModal";
import DlsiteNotificationModals from "../features/library/ui/DlsiteNotificationModals";
import Toast from "../shared/ui/Toast";
import type { DlsiteBulkResult, Work, WorkListItem } from "@mimimilli/shared";
import { getWork } from "../entities/work/api";
import { exportLibrary, searchWorks } from "../features/library/api";
import { formatScanProgressLabel } from "../features/scan/model";
import { useScanJob } from "../features/scan/useScanJob";
import { getLastScanResult, SCAN_QUERY_KEYS } from "../features/scan/api";
import { useDlsiteBulk } from "./model/useDlsiteBulk";
import { openDlsiteNotificationModalAtom } from "../features/library/model/dlsiteNotificationAtoms";
import { setRootFolder } from "../features/settings/api";
import { useSettingsQuery } from "../features/settings/useSettingsQuery";
import { appModeAtom } from "../features/navigation/model/navigationAtoms";
import NavigationHistorySync from "../features/navigation/ui/NavigationHistorySync";

export default function App() {
  const player = usePlayerActions();
  const queryClient = useQueryClient();
  const playRequestIdRef = useRef(0);
  const mode = useAtomValue(appModeAtom);
  const openDlsiteNotificationModal = useSetAtom(openDlsiteNotificationModalAtom);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [isCompletingSetup, setIsCompletingSetup] = useState(false);

  // ── Settings ─────────────────────────────────────────────
  const settingsQuery = useSettingsQuery();
  const settings = settingsQuery.data;
  const isSetupDone: boolean | null = settingsQuery.isPending
    ? null
    : settings?.rootFolder != null
      ? true
      : settingsQuery.isError
        ? false
        : false;

  // ファイルモードのルートパス（FilesView に渡す）。
  const rootFolder = settings?.rootFolder ?? "/";

  // ── DLsite一括取得（設定モーダル・TopBar共有、TASK-41） ────────
  const dlsiteBulk = useDlsiteBulk();

  // 前回スキャン結果（ディスク永続化なし、TASK-56）。サーバー起動後に一度でも完了していれば
  // GET /api/scan/last から取得でき、リロードをまたいでスキャンモーダル・通知ベルに表示できる。
  const lastScanQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.last(),
    queryFn: getLastScanResult,
  });
  const lastScanResult = lastScanQuery.data?.result ?? null;

  // ライブラリ総件数（サイドバーの「ライブラリ N 件」と同じ既存クエリキーを共有する）。
  // スキャンモーダルで統計バッジが全て0でも蔵書自体は0件ではないことを示すために使う。
  const libraryTotalQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.total(),
    queryFn: () => searchWorks({ limit: 1 }).then((page) => page.total),
  });

  const handleScanTerminal = useCallback(
    (job: import("@mimimilli/shared").ScanJobSnapshot) => {
      setIsCompletingSetup(false);
      if (job.status !== "completed" || !job.result || !job.finishedAt) return;
      const result = job.result;
      queryClient.setQueryData(SCAN_QUERY_KEYS.last(), { result, finishedAt: job.finishedAt });
      queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() });
      queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.dlsiteNotifications() });
      queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allFacets() });
      queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
      // スキャンで新規作品が見つかった場合、サーバーは自動でDLsite一括取得ジョブを
      // キューイングする（server/src/routes/scan.ts）。ここではAPIを呼ばずSSEに相乗りするだけ。
      if (result.newWorkIds.length > 0) dlsiteBulk.attach();
    },
    [dlsiteBulk, queryClient],
  );
  const scanJob = useScanJob({ onTerminal: handleScanTerminal });

  // ── Change folder mutation ────────────────────────────────
  const changeFolderMutation = useMutation({
    mutationFn: setRootFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
    },
  });

  // ── Play handler ──────────────────────────────────────────
  const handlePlay = useCallback(
    async (work: WorkListItem, trackIndex: number) => {
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

  const handleScan = useCallback(() => {
    void scanJob.start().catch(() => {});
  }, [scanJob]);
  const handleCancelScan = useCallback(() => {
    void scanJob.cancel().catch(() => {});
  }, [scanJob]);
  const handleCancelDlsiteBulk = useCallback(() => {
    void dlsiteBulk.cancel().catch(() => {});
  }, [dlsiteBulk]);
  // TopBarのスキャンボタンは即時実行せずモーダルを開く（TASK-56）。実行中なら実行中の表示に復帰する。
  const handleOpenScanModal = useCallback(() => setShowScanModal(true), []);

  // スキャン進捗のリアルタイム表示（TASK-20）。TopBar / SettingsModal / SetupScreen で共有する。
  const scanProgress = scanJob.job?.progress ?? null;
  const scanProgressLabel = formatScanProgressLabel(scanProgress);

  const handleSetupComplete = useCallback(
    async (path: string) => {
      setIsCompletingSetup(true);
      try {
        await setRootFolder(path);
        queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
        await scanJob.start();
        queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), (prev: typeof settings) =>
          prev ? { ...prev, rootFolder: path } : prev,
        );
      } catch (error) {
        setIsCompletingSetup(false);
        console.error("初回スキャンの開始に失敗しました", error);
      }
    },
    [queryClient, scanJob],
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
        onCancelScan={handleCancelScan}
        scanning={isCompletingSetup || scanJob.scanning}
        scanProgressLabel={scanProgressLabel}
        scanError={scanJob.error}
      />
    );
  }

  return (
    <AppShell
      topBar={
        <TopBar
          mode={mode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenScan={handleOpenScanModal}
          onSettings={() => setShowSettings(true)}
          scanning={scanJob.scanning}
          scanProgressLabel={scanProgressLabel}
          notificationBell={
            <NotificationBell
              dlsiteBulkActive={dlsiteBulk.active}
              dlsiteBulkProgress={dlsiteBulk.progress}
              onStartDlsiteBulk={dlsiteBulk.start}
              scanResult={lastScanResult}
              onOpenScanResult={handleOpenScanModal}
            />
          }
          dlsiteBulkActive={dlsiteBulk.active}
          dlsiteBulkProgress={dlsiteBulk.progress}
          dlsiteBulkCancelling={dlsiteBulk.cancelling}
          onCancelDlsiteBulk={handleCancelDlsiteBulk}
        />
      }
      addressBar={<AddressBar />}
      leftNav={<LeftNav />}
      body={
        mode === "files" ? (
          <FilesView rootFolder={rootFolder} onPlayFile={handlePlayFile} />
        ) : (
          <LibraryView
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onPlay={handlePlay}
            onResume={handleResume}
          />
        )
      }
      transportBar={<PlayerDock />}
      fullScreenPlayer={<FullScreenPlayerGate />}
      overlays={
        <>
          <PlayerRuntime />
          <NavigationHistorySync />
          {showSettings && (
            <SettingsModal
              rootFolder={settings?.rootFolder ?? null}
              lastScanTime={settings?.lastScanTime ?? null}
              scanning={scanJob.scanning}
              scanProgressLabel={scanProgressLabel}
              dlsiteBulk={{
                active: dlsiteBulk.active,
                progress: dlsiteBulk.progress,
                onStart: dlsiteBulk.start,
              }}
              onClose={() => setShowSettings(false)}
              onOpenScan={() => {
                setShowSettings(false);
                setShowScanModal(true);
              }}
              onChangeFolder={handleChangeFolder}
              onExport={handleExport}
            />
          )}
          {showScanModal && (
            <ScanModal
              scanning={scanJob.scanning}
              progress={scanProgress}
              lastResult={lastScanResult}
              lastScanTime={settings?.lastScanTime ?? null}
              libraryTotal={libraryTotalQuery.data ?? null}
              onStart={handleScan}
              onCancel={handleCancelScan}
              onClose={() => setShowScanModal(false)}
              onOpenRjCodeMissing={() => {
                setShowScanModal(false);
                openDlsiteNotificationModal("rj-missing");
              }}
            />
          )}
          <DlsiteNotificationModals onBeforeNavigateToWork={() => setShowScanModal(false)} />
          <Toast
            message={
              scanJob.error ??
              (dlsiteBulk.cancelledResult
                ? `DLsite一括取得を中断しました（${formatDlsiteBulkResult(dlsiteBulk.cancelledResult)}）`
                : dlsiteBulk.result
                  ? `DLsite一括取得: ${formatDlsiteBulkResult(dlsiteBulk.result)}`
                  : dlsiteBulk.error)
            }
            onDismiss={scanJob.error ? scanJob.clearError : dlsiteBulk.dismiss}
          />
        </>
      }
    />
  );
}

function formatDlsiteBulkResult(result: DlsiteBulkResult): string {
  const base = `取得 ${result.fetched}件・失敗 ${result.failed}件`;
  return result.parseErrors > 0 ? `${base}（うちパース ${result.parseErrors}件）` : base;
}
