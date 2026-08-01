import type { Work, WorkPatch } from "@mimimilli/shared";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import type { CollectionStatsDisplay } from "../model/libraryPresentation";
import CollectionStatus from "./CollectionStatus";
import { CollectionPlaceholder } from "./preview/CollectionPlaceholder";
import { WorkDetail } from "./preview/WorkDetail";

interface WorkGridInspectorProps {
  /** 作品が選択されているか。false のときは未選択プレースホルダーを表示する */
  hasSelection: boolean;
  work: Work | null;
  isLoading: boolean;
  isError: boolean;
  /** 詳細取得の再試行（isError時。404は呼び出し元で選択解除されるため、ここに来る
   *  isError=trueは404以外の一時的な失敗のみ） */
  onRetry?: () => void;
  /** 未選択時に表示する、表示中コレクションの統計 */
  collectionStats: CollectionStatsDisplay;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  tagSuggestions: string[];
  isPatching: boolean;
  onClose: () => void;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onTogglePlay: () => void;
  onTagClick: (tag: string) => void;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
}

export default function WorkGridInspector({
  hasSelection,
  work,
  isLoading,
  isError,
  onRetry,
  collectionStats,
  playingTrackIndex,
  isPlaybackActive,
  tagSuggestions,
  isPatching,
  onClose,
  onPlay,
  onResume,
  onTogglePlay,
  onTagClick,
  onPatchWork,
}: WorkGridInspectorProps) {
  return (
    <aside className="mll-grid-inspector" aria-label="作品インスペクタ">
      <div className="mll-grid-inspector__hd">
        <span className="label">詳細</span>
        <IconButton icon={I.x} label="パネルを閉じる" size="sm" onClick={onClose} />
      </div>
      {!hasSelection ? (
        <CollectionPlaceholder message="作品を選択してください" stats={collectionStats} />
      ) : work ? (
        <WorkDetail
          key={work.id}
          work={work}
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
      ) : isLoading ? (
        <CollectionStatus variant="list" kind="loading" />
      ) : (
        isError && <CollectionStatus variant="list" kind="error" onRetry={onRetry} />
      )}
    </aside>
  );
}
