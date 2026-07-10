import type { Work, WorkPatch } from "@mimimilli/shared";
import IconButton from "../../../shared/ui/IconButton";
import { I } from "../../../shared/ui/Icon";
import { WorkDetail } from "./preview/WorkDetail";

interface WorkGridInspectorProps {
  work: Work | null;
  isLoading: boolean;
  isError: boolean;
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
  work,
  isLoading,
  isError,
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
        <IconButton icon={I.x} label="インスペクタを閉じる" size="sm" onClick={onClose} />
      </div>
      {work ? (
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
