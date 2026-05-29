import { useState, useCallback, useEffect } from "react";
import { usePlayer } from "./hooks/usePlayer";
import TopBar from "./components/AppShell/TopBar";
import LeftNav from "./components/AppShell/LeftNav";
import AddressBar from "./components/AppShell/AddressBar";
import LibraryView from "./components/Library/LibraryView";
import TransportBar from "./components/Player/TransportBar";
import FullScreenPlayer from "./components/Player/FullScreenPlayer";
import SetupScreen from "./components/SetupScreen";
import SettingsModal from "./components/SettingsModal";
import type { WorkSummary } from "./types";
import * as api from "./api";

type AppMode = "library" | "files";

export default function App() {
  const player = usePlayer();

  const [mode] = useState<AppMode>("library");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [rootFolder, setRootFolder] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isSetupDone, setIsSetupDone] = useState<boolean | null>(null); // null = loading

  // Load settings on mount
  useEffect(() => {
    api.getRootFolder()
      .then((folder) => {
        setRootFolder(folder);
        setIsSetupDone(folder !== null);
      })
      .catch(() => setIsSetupDone(false));
    api.getLastScanTime().then(setLastScanTime).catch(() => {});
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.code === "Space" && player.state.currentWork) {
        e.preventDefault();
        player.togglePlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [player]);

  // Play handler: fetch full work detail, then call player.play
  const handlePlay = useCallback(async (work: WorkSummary, trackIndex: number) => {
    try {
      const fullWork = await api.getWork(work.id);
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
  }, [player]);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      await api.scanLibrary();
      setLastScanTime(new Date().toISOString());
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  }, []);

  const handleSetupComplete = useCallback(async (path: string) => {
    setScanning(true);
    try {
      await api.setRootFolder(path);
      setRootFolder(path);
      await api.scanLibrary();
      setLastScanTime(new Date().toISOString());
      setIsSetupDone(true);
    } catch {
      // ignore
    } finally {
      setScanning(false);
    }
  }, []);

  const handleChangeFolder = useCallback(async (path: string) => {
    await api.setRootFolder(path);
    setRootFolder(path);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const data = await api.exportLibrary();
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
    return <SetupScreen onComplete={handleSetupComplete} scanning={scanning} />;
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
          rootFolder={rootFolder}
          lastScanTime={lastScanTime}
          scanning={scanning}
          onClose={() => setShowSettings(false)}
          onScan={handleScan}
          onChangeFolder={handleChangeFolder}
          onExport={handleExport}
        />
      )}
    </div>
  );
}
