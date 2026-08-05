import type { NormalizedTag, Work, WorkPatchInput } from "@mimimilli/shared";
import type { CollectionStatsDisplay } from "../model/libraryPresentation";
import CollectionStatus from "./CollectionStatus";
import { DiscoveryDashboard } from "./preview/DiscoveryDashboard";
import { WorkDetail } from "./preview/WorkDetail";

// 作品詳細のプレビュー。ADR-0012 §3 により、結果面は常に全幅で表示し、
// プレビューは作品選択時にだけスライドインする（LibraryView 側で Presence を使って配線）。
// home 軸のときだけ例外的に、軸そのものの結果面（発見ダッシュボード）として使う。

export type PreviewMode = "work" | "home";

interface PreviewPaneProps {
  mode: PreviewMode;
  /** mode==="home" のときに表示するライブラリ全体の統計 */
  homeStats: CollectionStatsDisplay;
  selectedWork: Work | null;
  /** mode==="work"だがselectedWorkがまだ無いとき（読み込み中/404以外のエラー）の状態。
   *  404は呼び出し元で選択解除されるため、isSelectedWorkError=trueはそれ以外の一時的な失敗のみ */
  isSelectedWorkLoading: boolean;
  isSelectedWorkError: boolean;
  onRetrySelectedWork?: () => void;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onTogglePlay: () => void;
  onSelectWork: (id: string) => void;
  onTagClick: (tag: NormalizedTag) => void;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatchInput) => Promise<Work>;
}

export default function PreviewPane({
  mode,
  homeStats,
  selectedWork,
  isSelectedWorkLoading,
  isSelectedWorkError,
  onRetrySelectedWork,
  playingTrackIndex,
  isPlaybackActive,
  onPlay,
  onResume,
  onTogglePlay,
  onSelectWork,
  onTagClick,
  tagSuggestions,
  isPatching,
  onPatchWork,
}: PreviewPaneProps) {
  const title = mode === "work" ? "詳細" : "ホーム";

  return (
    <div className="mle-prv">
      <div className="mle-prv__hd">
        <span className="label">{title}</span>
      </div>
      {mode === "work" &&
        (selectedWork ? (
          <WorkDetail
            key={selectedWork.id}
            work={selectedWork}
            onPlay={onPlay}
            onResume={onResume}
            onTogglePlay={onTogglePlay}
            playingTrackIndex={playingTrackIndex}
            isPlaybackActive={isPlaybackActive}
            tagSuggestions={tagSuggestions}
            isPatching={isPatching}
            onPatchWork={onPatchWork}
            onTagClick={onTagClick}
          />
        ) : isSelectedWorkLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : (
          isSelectedWorkError && (
            <CollectionStatus variant="list" kind="error" onRetry={onRetrySelectedWork} />
          )
        ))}
      {mode === "home" && <DiscoveryDashboard stats={homeStats} onSelectWork={onSelectWork} />}
    </div>
  );
}
