import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePlayer } from "./hooks/usePlayer";
import TopBar from "./components/AppShell/TopBar";
import LeftNav from "./components/AppShell/LeftNav";
import AddressBar from "./components/AppShell/AddressBar";
import LibraryView, { LIBRARY_KEYS } from "./features/library/ui/LibraryView";
import TransportBar from "./components/Player/TransportBar";
import FullScreenPlayer from "./components/Player/FullScreenPlayer";
import SetupScreen from "./components/SetupScreen";
import SettingsModal from "./components/SettingsModal";
import NewWorkPopup from "./components/NewWorkPopup";
import type { ScanResult, WorkSummary } from "./types";
import { getWork } from "./entities/work/api";
import { exportLibrary } from "./features/library/api";
import { scanLibrary } from "./features/scan/api";
import { getSettings, setRootFolder } from "./features/settings/api";

type AppMode = "library" | "files";

// settings query key（App と SettingsModal が同じキャッシュを参照）
const SETTINGS_KEY = ["settings"] as const;

export default function App() {
  const player = usePlayer();
  const queryClient = useQueryClient();
  const playRequestIdRef = useRef(0);

  const [mode] = useState<AppMode>("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // ── Settings (TanStack Query) ──────────────────────────────
  const settingsQuery = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: getSettings,
    retry: 1,
  });
  const settings = settingsQuery.data;
  const isSetupDone: boolean | null = settingsQuery.isPending
    ? null
    : (settings?.rootFolder != null) || settingsQuery.isError ? (settings?.rootFolder != null) : false;

  // ── Scan mutation ─────────────────────────────────────────
  // 完了後に library の全クエリを invalidate し、scanVersion なしで自動再取得させる
  const scanMutation = useMutation({
    mutationFn: scanLibrary,
    onSuccess: (result) => {
      setScanResult(result);
      queryClient.invalidateQueries({ queryKey: ["works"] });
      queryClient.invalidateQueries({ queryKey: ["axisFacets"] });
      queryClient.invalidateQueries({ queryKey: ["smartFolderWorks"] });
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });

  // ── Change folder mutation ────────────────────────────────
  const changefolderMutation = useMutation({
    mutationFn: setRootFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    },
  });

  // Keyboard shortcuts（player 参照が変わっても安定するよう refs 経由）
  const playerRef = useRef(player);
  playerRef.current = player;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.code === "Space" && playerRef.current.state.currentWork) {
        e.preventDefault();
        playerRef.current.togglePlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []); // deps なし — handler は ref 越しに常に最新の player を参照

  // Play handler: LibraryView の workDetail query のキャッシュを再利用し、なければ fetch
  const handlePlay = useCallback(async (work: WorkSummary, trackIndex: number) => {
    const requestId = ++playRequestIdRef.current;
    try {
      const cached = queryClient.getQueryData<Awaited<ReturnType<typeof getWork>>>(
        LIBRARY_KEYS.workDetail(work.id)
      );
      const fullWork = cached ?? await getWork(work.id);
      if (requestId !== playRequestIdRef.current) return;
      if (!fullWork) return;
      const playlist = fullWork.playlists.find(
        (p) => p.name === (fullWork.defaultPlaylist ?? "default")
      ) ?? fullWork.playlists[0];
      const tracks = playlist?.tracks ?? [];
      if (tracks.length > 0) {
        player.play(work, tracks, Math.min(trackIndex, tracks.length - 1));
      }
    } catch {
      // ignore
    }
  }, [player, queryClient]);

  const handleScan = useCallback(() => {
    scanMutation.mutate();
  }, [scanMutation]);

  const handleSetupComplete = useCallback(async (path: string) => {
    await setRootFolder(path);
    queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    const result = await scanLibrary();
    setScanResult(result);
    queryClient.invalidateQueries({ queryKey: ["works"] });
    queryClient.invalidateQueries({ queryKey: ["axisFacets"] });
    queryClient.invalidateQueries({ queryKey: ["smartFolderWorks"] });
    queryClient.setQueryData(SETTINGS_KEY, (prev: typeof settings) =>
      prev ? { ...prev, rootFolder: path } : prev
    );
  }, [queryClient]);

  const handleChangeFolder = useCallback((path: string) => {
    changefolderMutation.mutate(path);
  }, [changefolderMutation]);

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
      // ignore
    }
  }, []);

  // Loading
  if (isSetupDone === null) {
    return (
      <div style={{ width: "100%", height: "100vh", background: "var(--paper-0)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "var(--font-jp)", fontSize: 13, color: "var(--ink-4)" }}>読み込み中...</span>
      </div>
    );
  }

  // Setup screen
  if (!isSetupDone) {
    return <SetupScreen onComplete={handleSetupComplete} scanning={scanMutation.isPending} />;
  }

  const isPlaying = player.state.currentTrackIndex >= 0 && player.state.currentWork !== null;
  const currentTrack = isPlaying ? player.state.tracks[player.state.currentTrackIndex] : null;
  const mixerClass = isPlaying ? "is-mixer-single" : "is-mixer-empty";

  return (
    <div className="mle-app">
      <div className={`mle-frame is-lib ${mixerClass}`}>
        <TopBar
          mode={mode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onScan={handleScan}
          onSettings={() => setShowSettings(true)}
          isPlaying={isPlaying}
          playingTrack={currentTrack?.title}
        />

        <AddressBar path={["ライブラリ"]} />

        <LeftNav mode={mode} playingCount={isPlaying ? 1 : 0} />

        <main className="mle-body">
          <LibraryView
            searchQuery={searchQuery}
            playingWorkId={player.state.currentWork?.id}
            playingTrackIndex={player.state.currentTrackIndex}
            onPlay={handlePlay}
          />
        </main>

        {isPlaying ? (
          <TransportBar
            state={player.state}
            onTogglePlay={player.togglePlay}
            onSeek={player.seek}
            onSeekRelative={player.seekRelative}
            onSetVolume={player.setVolume}
            onSetLoop={player.setLoop}
            onNext={player.nextTrack}
            onPrev={player.prevTrack}
            onExpand={() => player.setShowFullPlayer(true)}
          />
        ) : (
          <div className="mle-bar1 is-empty">
            <span>ファイル / 作品をクリックして再生</span>
            <span className="k">Space</span>
            <span>で再生 / 一時停止</span>
          </div>
        )}
      </div>

      {/* Full screen player */}
      {isPlaying && player.state.showFullPlayer && (
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
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsModal
          rootFolder={settings?.rootFolder ?? null}
          lastScanTime={settings?.lastScanTime ?? null}
          scanning={scanMutation.isPending}
          onClose={() => setShowSettings(false)}
          onScan={handleScan}
          onChangeFolder={handleChangeFolder}
          onExport={handleExport}
        />
      )}

      {scanResult && (
        <NewWorkPopup
          scanResult={scanResult}
          onClose={() => setScanResult(null)}
        />
      )}
    </div>
  );
}
