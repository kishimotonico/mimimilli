import type { NormalizedTag, Work } from "@mimimilli/shared";
import type { CollectionStatsDisplay } from "../model/libraryPresentation";
import type { LibraryViewState } from "../model/useLibraryNavigation";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { I } from "../../../shared/ui/Icon";
import { DiscoveryDashboard } from "./preview/DiscoveryDashboard";
import { WorkDetailPatchScope } from "./preview/WorkDetailPatchScope";

// 作品詳細のプレビュー。ADR-0012 §3 により、結果面は常に全幅で表示し、
// プレビューは作品選択時にだけスライドインする（LibraryView 側で AnimatePresence を使って配線）。
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
  nav: LibraryViewState;
  searchQuery: string;
  /** mode==="work" のときの閉じるボタン用。home 軸埋め込み・grid/listスライドインの
   *  どちらの経路でも同じ閉じ方にする（TASK-295）。 */
  onClose: () => void;
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
  nav,
  searchQuery,
  onClose,
}: PreviewPaneProps) {
  return (
    <div className="mle-prv-anchor">
      {mode === "work" && (
        <button
          type="button"
          className="mle-prv__close"
          aria-label="詳細を閉じる"
          onClick={onClose}
        >
          <I.chev size={14} />
        </button>
      )}
      <div className="mle-prv">
        {mode === "home" && (
          <div className="mle-prv__hd">
            <span className="label">ホーム</span>
          </div>
        )}
        {mode === "work" &&
          (selectedWork ? (
            <WorkDetailPatchScope
              key={selectedWork.id}
              work={selectedWork}
              nav={nav}
              searchQuery={searchQuery}
              onPlay={onPlay}
              onResume={onResume}
              onTogglePlay={onTogglePlay}
              playingTrackIndex={playingTrackIndex}
              isPlaybackActive={isPlaybackActive}
              tagSuggestions={tagSuggestions}
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
    </div>
  );
}
