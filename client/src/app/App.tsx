// App: アプリ全体のオーケストレーション。
// - 設定・スキャン・フォルダー変更を TanStack Query で管理
// - 再生開始は usePlayerActions のみ利用（state は leaf で購読）
// - レイアウトは AppShell に委譲

import { useState, useCallback, useEffect, useRef } from "react";
import { MotionConfig } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { usePlayerActions } from "../features/player/model/usePlayerActions";
import PlayerRuntime from "../features/player/ui/PlayerRuntime";
import AppShell from "./AppShell";
import AppBody from "./AppBody";
import TopBar from "./ui/TopBar";
import LeftNav from "./ui/LeftNav";
import AddressBar from "./ui/AddressBar";
import NotificationBell from "./ui/NotificationBell";
import { SETTINGS_QUERY_KEYS } from "../entities/settings/queryKeys";
import { SCAN_QUERY_KEYS } from "../entities/scan/queryKeys";
import { getLastScanResult } from "../features/scan/api";
import PlayerDock from "../features/player/ui/PlayerDock";
import { resolveAppStartupState } from "./model/resolveAppStartupState";
import RootConfigurationScreen from "../features/setup/ui/RootConfigurationScreen";
import StartupErrorScreen from "./ui/StartupErrorScreen";
import { LibraryNavigationProvider } from "../features/library/ui/LibraryNavigationProvider";
import GlobalToast from "./ui/GlobalToast";
import AppModals from "./ui/AppModals";
import { useToast } from "../shared/ui/useToast";
import { apiErrorMessage } from "../shared/lib/apiError";
import { activeModalAtom } from "../shared/model/activeModalAtom";
import type { RootReconfigurationState, Settings, Work, WorkListItem } from "@mimimilli/shared";
import { prepareWorkPlayback } from "../entities/work/api";
import { updateCachesAfterPlaybackPrepared } from "../entities/work/model/workCacheUpdates";
import { useDownloadLibraryExport } from "../features/library/useDownloadLibraryExport";
import { useDlsiteBulkActions } from "../entities/dlsite/useDlsiteBulkActions";
import { startRootReconfiguration } from "../entities/settings/api";
import { runStartRootReconfiguration } from "./model/runStartRootReconfiguration";
import {
  markReconfigurationAffectedQueriesStale,
  removeReconfigurationAffectedQueries,
} from "./model/resetLibraryForReconfiguration";
import { resetLibraryNavigationUrl } from "./model/resetLibraryNavigationUrl";
import { createPlayRequestGuard } from "./model/playRequestGuard";
import {
  useSettingsQuery,
  useRootFolderOrNull,
  requireRootFolder,
} from "../entities/settings/useSettingsQuery";
import NavigationHistorySync from "../features/navigation/ui/NavigationHistorySync";
import { setAppModeAtom } from "../shared/model/appModeAtoms";
import { openPathInFilesAtom } from "../entities/file-system/model/navigationAtoms";
import {
  setLibraryAxisAtom,
  selectLibraryWorkAtom,
  resetLibraryNavigationAtom,
} from "../entities/library/model/navigationActions";
import { scanCandidateHiddenPathsAtom } from "../entities/scan/model/atoms";
import { openWorkDetailAtom } from "../entities/work/model/navigationActions";

export default function App() {
  const player = usePlayerActions();
  const queryClient = useQueryClient();
  const toast = useToast();
  const dlsiteBulk = useDlsiteBulkActions();
  const setAppMode = useSetAtom(setAppModeAtom);
  const openPathInFiles = useSetAtom(openPathInFilesAtom);
  const setLibraryAxis = useSetAtom(setLibraryAxisAtom);
  const selectLibraryWork = useSetAtom(selectLibraryWorkAtom);
  const resetLibraryNavigation = useSetAtom(resetLibraryNavigationAtom);
  const setScanCandidateHiddenPaths = useSetAtom(scanCandidateHiddenPathsAtom);
  const openWorkDetail = useSetAtom(openWorkDetailAtom);
  const setActiveModal = useSetAtom(activeModalAtom);
  const playRequestGuard = useRef(createPlayRequestGuard()).current;

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
  // 再生停止とplayRequestGuardの無効化を1つの経路にまとめる。別々に呼ぶと
  // 呼び忘れが起きうるため、「止める」操作は常にこの関数を通す。
  const stopPlaybackAndInvalidateGuard = useCallback(() => {
    player.stop();
    playRequestGuard.invalidate();
  }, [player, playRequestGuard]);

  // 開始成功の直後（通常UIがまだアンマウントされる前）に呼ぶ軽量な初期化。
  // removeQueriesではなくmarkStale（refetchType:"none"）にするのは、生きたobserverの
  // 即時再フェッチがロック中のAPIへ409を飛ばすのを避けるため。フィクスチャの高速完了レースに
  // 備え、reconfiguring状態を実際に観測できなくてもここで選択・検索・候補は必ず初期化される。
  const applyImmediateReconfigurationReset = useCallback(() => {
    setActiveModal(null);
    resetLibraryNavigation();
    resetLibraryNavigationUrl();
    setScanCandidateHiddenPaths(new Set());
    markReconfigurationAffectedQueriesStale(queryClient);
  }, [queryClient, resetLibraryNavigation, setScanCandidateHiddenPaths, setActiveModal]);

  // reconfiguringへの出入りを検知する。startReconfiguration経由（自分で開始した場合）に
  // 加え、起動時に既にrunning/failedだった場合・他所からの409検知でsettingsが切り替わった場合も拾う。
  // 突入時: 通常UIが実際にアンマウント済みなので、removeQueriesで作品系クエリを丸ごと破棄できる
  // （復帰時に古いデータのstale-while-revalidate表示を挟まず必ず新規取得になる）。停止も
  // ここで呼ぶ: PlayerRuntimeProviderはstartupStateに関わらず常時マウントされているため、
  // 自分で開始した経路（runStartRootReconfiguration側で既に停止済み）以外の入り口でも再生を止める
  // 必要がある（重複して呼ばれても無害）。activeModalAtomも常時マウントのstoreに残るので閉じる。
  // 離脱時: サーバーは再構築完了時に新規作品をDLsite取得（new）へ渡す（ADR-0029）。
  // 従来スキャン完了時はScanRuntimeがdlsiteBulk.attach()して進捗・完了通知・クエリ無効化を
  // 拾っていたのと同じ経路を、再構築完了でも通す。
  const wasReconfiguringRef = useRef(false);
  useEffect(() => {
    const isReconfiguring = startupState === "reconfiguring";
    if (isReconfiguring && !wasReconfiguringRef.current) {
      stopPlaybackAndInvalidateGuard();
      setActiveModal(null);
      resetLibraryNavigation();
      resetLibraryNavigationUrl();
      setScanCandidateHiddenPaths(new Set());
      removeReconfigurationAffectedQueries(queryClient);
    } else if (!isReconfiguring && wasReconfiguringRef.current) {
      void queryClient
        .fetchQuery({ queryKey: SCAN_QUERY_KEYS.last(), queryFn: getLastScanResult })
        .then((last) => {
          if (last && last.result.insertedWorkIds.length > 0) dlsiteBulk.attach();
        })
        .catch(() => {});
    }
    wasReconfiguringRef.current = isReconfiguring;
  }, [
    startupState,
    queryClient,
    dlsiteBulk,
    stopPlaybackAndInvalidateGuard,
    setActiveModal,
    resetLibraryNavigation,
    setScanCandidateHiddenPaths,
  ]);

  // 202応答をsettingsキャッシュへ即時反映する。再取得（invalidateSettings）がそれより先に
  // idleを返す競合（フィクスチャの高速完了等）があっても、これで一度は確実にreconfiguring
  // 画面へ切り替わり、通常UIのアンマウント→作品系クエリの破棄が起きる。
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
        stopPlayback: stopPlaybackAndInvalidateGuard,
        resetLibraryForReconfiguration: applyImmediateReconfigurationReset,
        applyRootReconfigurationState,
        invalidateSettings: () =>
          queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() }),
      });
    },
    [
      applyImmediateReconfigurationReset,
      applyRootReconfigurationState,
      stopPlaybackAndInvalidateGuard,
      queryClient,
    ],
  );

  // ── Play handler ──────────────────────────────────────────
  const handlePlay = useCallback(
    async (work: WorkListItem, trackIndex: number) => {
      // ファイル欠損・メタ読み込みエラーの作品は再生できない（UI側の無効化が第一線、これは防衛線）。
      if (work.status !== "ok") return;
      const requestId = playRequestGuard.next();
      try {
        const fullWork = await prepareWorkPlayback(work.id);
        if (!playRequestGuard.isCurrent(requestId)) return;
        await updateCachesAfterPlaybackPrepared(queryClient, fullWork);
        if (!playRequestGuard.isCurrent(requestId)) return;
        const playlist =
          fullWork.playlists.find((p) => p.id === fullWork.defaultPlaylistId) ??
          fullWork.playlists[0];
        const tracks = playlist?.tracks ?? [];
        if (tracks.length > 0) {
          player.play(work, tracks, Math.min(trackIndex, tracks.length - 1), playlist!.id);
        }
      } catch (err) {
        toast.error(apiErrorMessage(err, "作品の再生に失敗しました"));
      }
    },
    [player, queryClient, toast, playRequestGuard],
  );

  const handleResume = useCallback(
    async (work: Work) => {
      if (work.status !== "ok") return;
      const requestId = playRequestGuard.next();
      try {
        const fullWork = await prepareWorkPlayback(work.id);
        if (!playRequestGuard.isCurrent(requestId)) return;
        await updateCachesAfterPlaybackPrepared(queryClient, fullWork);
        if (!playRequestGuard.isCurrent(requestId)) return;
        player.playWithResume(fullWork);
      } catch (err) {
        toast.error(apiErrorMessage(err, "作品の再生に失敗しました"));
      }
    },
    [player, queryClient, toast, playRequestGuard],
  );

  const handleChangeFolder = useCallback(
    (path: string) => startReconfiguration(path),
    [startReconfiguration],
  );

  const handleExport = useDownloadLibraryExport();

  const handleOpenLibraryWork = useCallback(
    (workId: string) => {
      setAppMode("library");
      setLibraryAxis("all");
      selectLibraryWork(workId);
    },
    [selectLibraryWork, setAppMode, setLibraryAxis],
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
        <RootConfigurationScreen state={{ status: "idle" }} onSubmit={startReconfiguration} />
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
          body={
            <AppBody
              onPlay={handlePlay}
              onResume={handleResume}
              onTogglePlay={player.togglePlay}
              onPlayFile={player.playFile}
              onOpenWorkDetail={handleOpenWorkDetail}
            />
          }
          transportBar={<PlayerDock onShowPlayingWork={handleOpenLibraryWork} />}
          overlays={
            <>
              <PlayerRuntime />
              <NavigationHistorySync />
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
