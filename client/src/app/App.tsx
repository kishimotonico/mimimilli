// App: アプリ全体のオーケストレーション。
// - 設定・スキャン・フォルダー変更を TanStack Query で管理
// - 再生開始は usePlayerActions のみ利用（state は leaf で購読）
// - レイアウトは AppShell に委譲

import { lazy, Suspense, useState, useCallback, useRef } from "react";
import { MotionConfig } from "motion/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { usePlayerActions } from "../features/player/model/usePlayerActions";
import PlayerRuntime from "../features/player/ui/PlayerRuntime";
import FullScreenPlayerGate from "../features/player/ui/FullScreenPlayerGate";
import AppShell from "./AppShell";
import AppBody from "./AppBody";
import TopBar from "./ui/TopBar";
import LeftNav from "./ui/LeftNav";
import AddressBar from "./ui/AddressBar";
import NotificationBell from "./ui/NotificationBell";
import { WORK_QUERY_KEYS } from "../entities/work/queryKeys";
import { SETTINGS_QUERY_KEYS } from "../entities/settings/queryKeys";
import PlayerDock from "../features/player/ui/PlayerDock";
import { resolveAppStartupState } from "./model/resolveAppStartupState";
import SetupScreen from "../features/setup/ui/SetupScreen";
import StartupErrorScreen from "./ui/StartupErrorScreen";
import DlsiteNotificationModals from "../features/library/ui/DlsiteNotificationModals";
import { LibraryNavigationProvider } from "../features/library/ui/LibraryNavigationProvider";
import GlobalToast from "./ui/GlobalToast";
import { errorToastAtom } from "../shared/model/errorToastAtom";
import { mutationErrorMessage } from "../shared/lib/mutationError";
import type { ActiveModal } from "./model/activeModal";
import { isDlsiteNotificationModal } from "./model/activeModal";
import type { Work, WorkListItem } from "@mimimilli/shared";
import { getWork } from "../entities/work/api";
import { useDownloadLibraryExport } from "../features/library/useDownloadLibraryExport";
import { useScanActions } from "../features/scan/model/useScanActions";
import { setRootFolder } from "../features/settings/api";
import { useSettingsQuery } from "../features/settings/useSettingsQuery";
import NavigationHistorySync from "../features/navigation/ui/NavigationHistorySync";

const SettingsModal = lazy(() => import("../features/settings/ui/SettingsModal"));
const ScanModal = lazy(() => import("../features/scan/ui/ScanModal"));

export default function App() {
  const player = usePlayerActions();
  const scanActions = useScanActions();
  const queryClient = useQueryClient();
  const setErrorToast = useSetAtom(errorToastAtom);
  const playRequestIdRef = useRef(0);

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  // ── Settings ─────────────────────────────────────────────
  const settingsQuery = useSettingsQuery();
  const settings = settingsQuery.data;
  const startupState = resolveAppStartupState({
    isPending: settingsQuery.isPending,
    isError: settingsQuery.isError,
    data: settings,
  });

  // ファイルモードのルートパス（FilesView に渡す）。
  const rootFolder = settings?.rootFolder ?? "/";

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
        const fullWork = await queryClient.ensureQueryData({
          queryKey: WORK_QUERY_KEYS.detail(work.id),
          queryFn: () => getWork(work.id),
        });
        if (requestId !== playRequestIdRef.current) return;
        const playlist =
          fullWork.playlists.find((p) => p.id === fullWork.defaultPlaylistId) ??
          fullWork.playlists[0];
        const tracks = playlist?.tracks ?? [];
        if (tracks.length > 0) {
          player.play(work, tracks, Math.min(trackIndex, tracks.length - 1), playlist!.id);
        }
      } catch (err) {
        setErrorToast(mutationErrorMessage(err, "作品の再生に失敗しました"));
      }
    },
    [player, queryClient, setErrorToast],
  );

  const handleResume = useCallback(
    (work: Work) => {
      if (work.status !== "ok") return;
      ++playRequestIdRef.current;
      player.playWithResume(work);
    },
    [player],
  );

  // TopBarのスキャンボタンは即時実行せずモーダルを開く（TASK-56）。実行中なら実行中の表示に復帰する。
  const handleOpenScanModal = useCallback(() => setActiveModal("scan"), []);
  const handleCloseModal = useCallback(() => setActiveModal(null), []);

  const handleSetupComplete = useCallback(
    async (path: string) => {
      await setRootFolder(path);
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
      const result = await scanActions.start();
      if (!result.ok) {
        throw new Error(result.error);
      }
      queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), (prev: typeof settings) =>
        prev ? { ...prev, rootFolder: path } : prev,
      );
    },
    [queryClient, scanActions],
  );

  const handleChangeFolder = useCallback(
    (path: string) => changeFolderMutation.mutate(path),
    [changeFolderMutation],
  );

  const handleExport = useDownloadLibraryExport();

  if (startupState === "loading") {
    return (
      <MotionConfig reducedMotion="user">
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
      </MotionConfig>
    );
  }

  if (startupState === "error") {
    return (
      <MotionConfig reducedMotion="user">
        <StartupErrorScreen
          error={settingsQuery.error}
          onRetry={() => {
            void settingsQuery.refetch();
          }}
          isRetrying={settingsQuery.isFetching}
        />
      </MotionConfig>
    );
  }

  if (startupState === "setup-required") {
    return (
      <MotionConfig reducedMotion="user">
        <SetupScreen onComplete={handleSetupComplete} />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <LibraryNavigationProvider>
        <AppShell
          topBar={
            <TopBar
              onOpenScan={handleOpenScanModal}
              onSettings={() => setActiveModal("settings")}
              notificationBell={
                <NotificationBell
                  onOpenScanResult={handleOpenScanModal}
                  onOpenNotificationModal={setActiveModal}
                />
              }
            />
          }
          addressBar={<AddressBar />}
          leftNav={<LeftNav />}
          body={
            <AppBody
              rootFolder={rootFolder}
              onPlay={handlePlay}
              onResume={handleResume}
              onTogglePlay={player.togglePlay}
            />
          }
          transportBar={<PlayerDock />}
          fullScreenPlayer={<FullScreenPlayerGate />}
          overlays={
            <>
              <PlayerRuntime />
              <NavigationHistorySync />
              {activeModal === "settings" && (
                <Suspense fallback={null}>
                  <SettingsModal
                    rootFolder={settings?.rootFolder ?? null}
                    lastScanTime={settings?.lastScanTime ?? null}
                    onClose={handleCloseModal}
                    onOpenScan={() => setActiveModal("scan")}
                    onChangeFolder={handleChangeFolder}
                    onExport={handleExport}
                  />
                </Suspense>
              )}
              {activeModal === "scan" && (
                <Suspense fallback={null}>
                  <ScanModal
                    lastScanTime={settings?.lastScanTime ?? null}
                    onClose={handleCloseModal}
                    onOpenRjCodeMissing={() => setActiveModal("rj-missing")}
                  />
                </Suspense>
              )}
              <DlsiteNotificationModals
                activeModal={isDlsiteNotificationModal(activeModal) ? activeModal : null}
                onClose={handleCloseModal}
              />
              <GlobalToast />
            </>
          }
        />
      </LibraryNavigationProvider>
    </MotionConfig>
  );
}
