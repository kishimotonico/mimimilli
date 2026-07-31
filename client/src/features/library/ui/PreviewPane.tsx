import type { Work, WorkListItem, WorkPatch, SmartFolder } from "@mimimilli/shared";
import type { AxisLandingPresentation } from "../model/axisLandingPresentation";
import type { CollectionStatsDisplay, PreviewMode } from "../model/libraryPresentation";
import { AxisLanding } from "./preview/AxisLanding";
import { CollectionPlaceholder } from "./preview/CollectionPlaceholder";
import { SmartFolderView } from "./preview/SmartFolderView";
import { WorkDetail } from "./preview/WorkDetail";

// ── Main ──────────────────────────────────────────────────────

interface PreviewPaneProps {
  mode: PreviewMode;
  showNoResultsHint: boolean;
  /** mode==="empty" かつ showNoResultsHint===false のときに表示する統計 */
  emptyStats: CollectionStatsDisplay;
  axisLandingPresentation: AxisLandingPresentation;
  selectedWork: Work | null;
  smartFolder: SmartFolder | null;
  axisWorks: WorkListItem[];
  axisTotal?: number;
  smartFolderWorks: WorkListItem[];
  smartFolderTotal?: number;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onSelectWork: (id: string) => void;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
  onEditSmartFolder: (folder: SmartFolder) => void;
}

export default function PreviewPane({
  mode,
  showNoResultsHint,
  emptyStats,
  axisLandingPresentation,
  selectedWork,
  smartFolder,
  axisWorks,
  axisTotal,
  smartFolderWorks,
  smartFolderTotal,
  playingTrackIndex,
  isPlaybackActive,
  onPlay,
  onResume,
  onSelectWork,
  tagSuggestions,
  isPatching,
  onPatchWork,
  onEditSmartFolder,
}: PreviewPaneProps) {
  const title =
    mode === "work"
      ? "詳細"
      : mode === "smart-folder"
        ? "スマートフォルダー"
        : mode === "axis-landing"
          ? axisLandingPresentation.panelTitle
          : "プレビュー";

  return (
    <div className="mle-prv">
      <div className="mle-prv__hd">
        <span className="label">{title}</span>
      </div>
      {mode === "work" && selectedWork && (
        <WorkDetail
          key={selectedWork.id}
          work={selectedWork}
          onPlay={onPlay}
          onResume={onResume}
          playingTrackIndex={playingTrackIndex}
          isPlaybackActive={isPlaybackActive}
          tagSuggestions={tagSuggestions}
          isPatching={isPatching}
          onPatchWork={onPatchWork}
        />
      )}
      {mode === "axis-landing" && (
        <AxisLanding
          presentation={axisLandingPresentation}
          works={axisWorks}
          total={axisTotal}
          onSelectWork={onSelectWork}
        />
      )}
      {mode === "smart-folder" && smartFolder && (
        <SmartFolderView
          sf={smartFolder}
          works={smartFolderWorks}
          total={smartFolderTotal}
          onEdit={() => onEditSmartFolder(smartFolder)}
        />
      )}
      {mode === "empty" && (
        <CollectionPlaceholder
          message={showNoResultsHint ? "作品が見つかりません" : "作品を選択してください"}
          hint={showNoResultsHint ? "検索条件を変えてみてください" : undefined}
          stats={showNoResultsHint ? undefined : emptyStats}
        />
      )}
    </div>
  );
}
