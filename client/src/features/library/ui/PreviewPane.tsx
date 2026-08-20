import type { NormalizedTag, Work } from "@mimimilli/shared";
import type { LibraryViewActions, LibraryViewState } from "../model/useLibraryNavigation";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { I } from "../../../shared/ui/Icon";
import { WorkDetailPatchScope } from "./preview/WorkDetailPatchScope";

// 作品詳細のプレビュー。ADR-0012 §3 により、結果面は常に全幅で表示し、
// プレビューは作品選択時にだけスライドインする（LibraryView 側で AnimatePresence を使って配線）。

interface PreviewPaneProps {
  selectedWork: Work | null;
  /** selectedWorkがまだ無いとき（読み込み中/404以外のエラー）の状態。
   *  404は呼び出し元で選択解除されるため、isSelectedWorkError=trueはそれ以外の一時的な失敗のみ */
  isSelectedWorkLoading: boolean;
  isSelectedWorkError: boolean;
  onRetrySelectedWork?: () => void;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onTogglePlay: () => void;
  onTagClick: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  tagSuggestions: string[];
  nav: LibraryViewState & Pick<LibraryViewActions, "selectWork">;
  searchQuery: string;
  /** grid/listスライドインどちらの経路でも同じ閉じ方にする（TASK-295）。 */
  onClose: () => void;
  /** 全画面詳細（/work/:id）へ遷移する */
  onExpand: () => void;
  /** 表示中の作品が再生中の作品と一致するときだけ渡す */
  onGoToPlayingScreen?: () => void;
}

export default function PreviewPane({
  selectedWork,
  isSelectedWorkLoading,
  isSelectedWorkError,
  onRetrySelectedWork,
  playingTrackIndex,
  isPlaybackActive,
  onPlay,
  onResume,
  onTogglePlay,
  onTagClick,
  tagSuggestions,
  nav,
  searchQuery,
  onClose,
  onExpand,
  onGoToPlayingScreen,
}: PreviewPaneProps) {
  return (
    <div className="mle-prv-anchor">
      <button type="button" className="mle-prv__close" aria-label="詳細を閉じる" onClick={onClose}>
        <I.chev size={14} />
      </button>
      <div className="mle-prv">
        {selectedWork ? (
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
            onExpand={onExpand}
            onGoToPlayingScreen={onGoToPlayingScreen}
          />
        ) : isSelectedWorkLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : (
          isSelectedWorkError && (
            <CollectionStatus variant="list" kind="error" onRetry={onRetrySelectedWork} />
          )
        )}
      </div>
    </div>
  );
}
