// App: アプリ全体のオーケストレーション。
// - 設定・スキャン・フォルダー変更を TanStack Query で管理
// - 再生は root 再設定時の停止と最終 resume 保存のみ（開始は各画面が直接呼ぶ。state は leaf で購読）
// - レイアウトは AppShell に委譲

import { useState, useCallback, useEffect, useRef } from "react";
import { MotionConfig } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { usePlayerActions } from "../entities/player/model/usePlayerActions";
import PlayerRuntime from "../features/player/ui/PlayerRuntime";
import ReconfigurationExitEffect from "./ReconfigurationExitEffect";
import ReconfigurationEntryEffect from "./ReconfigurationEntryEffect";
import RootReconfigurationDriftEffect from "./RootReconfigurationDriftEffect";
import AppShell from "./AppShell";
import AppBody from "./AppBody";
import TopBar from "./ui/TopBar";
import LeftNav from "./ui/LeftNav";
import AddressBar from "./ui/AddressBar";
import NotificationBell from "./ui/NotificationBell";
import { SETTINGS_QUERY_KEYS } from "../entities/settings/queryKeys";
import PlayerDock from "../features/player/ui/PlayerDock";
import { resolveAppStartupState } from "./model/resolveAppStartupState";
import RootConfigurationScreen from "../features/setup/ui/RootConfigurationScreen";
import StartupErrorScreen from "./ui/StartupErrorScreen";
import { LibraryNavigationProvider } from "../features/library/ui/LibraryNavigationProvider";
import GlobalToast from "./ui/GlobalToast";
import AppModals from "./ui/AppModals";
import { activeModalAtom } from "../shared/model/activeModalAtom";
import type { RootReconfigurationState, Settings } from "@mimimilli/shared";
import { useDownloadLibraryExport } from "../features/library/useDownloadLibraryExport";
import { useScanJobStore } from "../entities/scan/useScanJob";
import { startRootReconfiguration } from "../entities/settings/api";
import { runStartRootReconfiguration } from "./model/runStartRootReconfiguration";
import { markReconfigurationAffectedQueriesStale } from "./model/resetLibraryForReconfiguration";
import {
  useSettingsQuery,
  useRootFolderOrNull,
  requireRootFolder,
} from "../entities/settings/useSettingsQuery";
import { reconfigurationExitEpochAtom } from "../entities/settings/reconfigurationExitAtom";
import { navigateAtom } from "../entities/navigation/model/appRouteStore";
import { DEFAULT_APP_ROUTE } from "../entities/navigation/model/appRoute";
import { openPathInFilesAtom } from "../entities/file-system/model/navigationAtoms";
import { showLibraryWorkAtom } from "../entities/library/model/navigationActions";
import { scanCandidateHiddenPathsAtom } from "../entities/scan/model/atoms";
import { dlsiteBulkApplyOpenAtom } from "../entities/dlsite/model/bulkAtoms";
import { openWorkDetailAtom } from "../entities/work/model/navigationActions";

export default function App() {
  const player = usePlayerActions();
  const queryClient = useQueryClient();
  const scanJob = useScanJobStore();
  const navigate = useSetAtom(navigateAtom);
  const openPathInFiles = useSetAtom(openPathInFilesAtom);
  const showLibraryWork = useSetAtom(showLibraryWorkAtom);
  const setScanCandidateHiddenPaths = useSetAtom(scanCandidateHiddenPathsAtom);
  const openWorkDetail = useSetAtom(openWorkDetailAtom);
  const setActiveModal = useSetAtom(activeModalAtom);
  const setDlsiteBulkApplyOpen = useSetAtom(dlsiteBulkApplyOpenAtom);
  const bumpReconfigurationExitEpoch = useSetAtom(reconfigurationExitEpochAtom);

  // ── Settings ─────────────────────────────────────────────
  const settingsQuery = useSettingsQuery();
  const settings = settingsQuery.data;
  const rootFolderOrNull = useRootFolderOrNull();
  // 再試行中（isPending===true・error===null に巻き戻る）でも起動エラー画面の文脈を保つため、
  // 直近のエラーを保持する。成功したら破棄する
  const [lastStartupError, setLastStartupError] = useState<unknown>(undefined);
  if (settingsQuery.isError && settingsQuery.error !== lastStartupError) {
    setLastStartupError(settingsQuery.error);
  } else if (settingsQuery.isSuccess && lastStartupError !== undefined) {
    setLastStartupError(undefined);
  }
  const startupState = resolveAppStartupState({
    isPending: settingsQuery.isPending,
    isError: settingsQuery.isError,
    data: settings,
    hasErroredBefore: lastStartupError !== undefined,
  });

  // ── root再設定（ADR-0029） ──────────────────────────────────
  // 突入側の非破壊な後処理。自分で開始した経路・起動時に既にrunning/failedだった経路・
  // DriftEffect（別タブでの完了検知）で共有する。作品系クエリの実際の破棄
  // （removeQueries）は通常UIのobserverがまだ生きている可能性があるためここではしない
  // （stale化のみ。実際の破棄はReconfigurationEntryEffect/ReconfigurationExitEffect）。
  const performReconfigurationEntryReset = useCallback(() => {
    player.stop();
    setActiveModal(null);
    setDlsiteBulkApplyOpen(false);
    scanJob.reset();
    navigate(DEFAULT_APP_ROUTE, { replace: true });
    setScanCandidateHiddenPaths(new Set());
    bumpReconfigurationExitEpoch((epoch) => epoch + 1);
    markReconfigurationAffectedQueriesStale(queryClient);
  }, [
    navigate,
    queryClient,
    scanJob,
    setActiveModal,
    setDlsiteBulkApplyOpen,
    bumpReconfigurationExitEpoch,
    setScanCandidateHiddenPaths,
    player,
  ]);

  // 自分で開始していない経路（起動時に既にrunning/failed・他所からの409検知）の突入検知。
  // 自分で開始した経路での再呼び出しは無害な重複（performReconfigurationEntryRestは冪等）。
  const wasReconfiguringRef = useRef(false);
  useEffect(() => {
    const isReconfiguring = startupState === "reconfiguring";
    if (isReconfiguring && !wasReconfiguringRef.current) {
      performReconfigurationEntryReset();
    }
    wasReconfiguringRef.current = isReconfiguring;
  }, [startupState, performReconfigurationEntryReset]);

  // 離脱側の後処理（DLsite attach等）はReconfigurationExitEffectへ分離する
  // （App.tsxはJotaiのread APIを持たない方針のため）。

  // 202応答をsettingsキャッシュへ即時反映する。
  const applyRootReconfigurationState = useCallback(
    (state: RootReconfigurationState) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), (prev: Settings | undefined) =>
        prev ? { ...prev, rootReconfiguration: state } : prev,
      );
    },
    [queryClient],
  );

  const startReconfiguration = useCallback(
    async (path: string): Promise<void> => {
      await runStartRootReconfiguration(path, {
        startRootReconfiguration,
        persistFinalResume: player.flushCurrentResume,
        performEntryReset: performReconfigurationEntryReset,
        applyRootReconfigurationState,
        invalidateSettings: () =>
          queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() }),
      });
    },
    [applyRootReconfigurationState, performReconfigurationEntryReset, player, queryClient],
  );

  const handleChangeFolder = useCallback(
    (path: string) => startReconfiguration(path),
    [startReconfiguration],
  );

  const handleExport = useDownloadLibraryExport();

  const handleOpenLibraryWork = useCallback(
    (workId: string) => showLibraryWork(workId),
    [showLibraryWork],
  );

  const handleOpenWorkDetail = useCallback(
    (workId: string) => openWorkDetail(workId),
    [openWorkDetail],
  );

  const handleOpenScanProblemInFiles = useCallback(
    (path: string) => {
      openPathInFiles({ path, root: requireRootFolder(rootFolderOrNull) });
      setActiveModal(null);
    },
    [openPathInFiles, rootFolderOrNull, setActiveModal],
  );

  if (startupState === "loading") {
    return (
      <MotionConfig reducedMotion="user">
        <div className="flex h-screen w-full items-center justify-center bg-paper-0">
          <span className="font-jp text-[13px] text-ink-4">読み込み中...</span>
        </div>
      </MotionConfig>
    );
  }

  if (startupState === "error") {
    return (
      <MotionConfig reducedMotion="user">
        <StartupErrorScreen
          error={settingsQuery.error ?? lastStartupError}
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
        <RootConfigurationScreen
          state={{ status: "idle", completedAt: null }}
          onSubmit={startReconfiguration}
        />
      </MotionConfig>
    );
  }

  if (
    startupState === "reconfiguring" &&
    settings &&
    settings.rootReconfiguration.status !== "idle"
  ) {
    return (
      <MotionConfig reducedMotion="user">
        <ReconfigurationEntryEffect />
        <RootConfigurationScreen
          state={settings.rootReconfiguration}
          onSubmit={startReconfiguration}
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <LibraryNavigationProvider>
        <AppShell
          topBar={<TopBar notificationBell={<NotificationBell />} />}
          addressBar={<AddressBar />}
          leftNav={<LeftNav />}
          body={<AppBody onOpenWorkDetail={handleOpenWorkDetail} />}
          transportBar={<PlayerDock onShowPlayingWork={handleOpenLibraryWork} />}
          overlays={
            <>
              <PlayerRuntime />
              <ReconfigurationExitEffect />
              <RootReconfigurationDriftEffect onDrift={performReconfigurationEntryReset} />
              <AppModals
                lastScanTime={settings?.lastScanTime ?? null}
                onChangeFolder={handleChangeFolder}
                onExport={handleExport}
                onOpenFiles={handleOpenScanProblemInFiles}
                onOpenWork={handleOpenLibraryWork}
              />
              <GlobalToast />
            </>
          }
        />
      </LibraryNavigationProvider>
    </MotionConfig>
  );
}
