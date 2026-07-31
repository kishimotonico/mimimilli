import type { Work, WorkPatch } from "@mimimilli/shared";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import { WorkDetail } from "./preview/WorkDetail";

interface CollectionSummary {
  label: string;
  count: number;
}

interface WorkGridInspectorProps {
  /** 作品が選択されているか。false のときは summary を表示する */
  hasSelection: boolean;
  work: Work | null;
  isLoading: boolean;
  isError: boolean;
  summary: CollectionSummary;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  tagSuggestions: string[];
  isPatching: boolean;
  onClose: () => void;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
}

export default function WorkGridInspector({
  hasSelection,
  work,
  isLoading,
  isError,
  summary,
  playingTrackIndex,
  isPlaybackActive,
  tagSuggestions,
  isPatching,
  onClose,
  onPlay,
  onResume,
  onPatchWork,
}: WorkGridInspectorProps) {
  return (
    <aside className="mll-grid-inspector" aria-label="作品インスペクタ">
      <div className="mll-grid-inspector__hd">
        <span className="label">詳細</span>
        <IconButton icon={I.x} label="パネルを閉じる" size="sm" onClick={onClose} />
      </div>
      {!hasSelection ? (
        <div className="mll-grid-inspector__summary">
          <span className="mll-grid-inspector__summary-count">{summary.count} 件</span>
          <span className="mll-grid-inspector__summary-label">{summary.label}</span>
          <span className="mll-grid-inspector__summary-hint">
            作品を選択するとここに詳細が表示されます
          </span>
        </div>
      ) : work ? (
        <WorkDetail
          key={work.id}
          work={work}
          onPlay={onPlay}
          onResume={onResume}
          playingTrackIndex={playingTrackIndex}
          isPlaybackActive={isPlaybackActive}
          tagSuggestions={tagSuggestions}
          isPatching={isPatching}
          onPatchWork={onPatchWork}
        />
      ) : (
        <div className="mll-grid-inspector__status">
          {isError ? "詳細の読み込みに失敗しました" : isLoading ? "読み込み中..." : null}
        </div>
      )}
    </aside>
  );
}
