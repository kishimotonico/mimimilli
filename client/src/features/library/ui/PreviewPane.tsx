import type { Work, WorkPatch, SmartFolder, WorkSummary } from "@mimimilli/shared";
import type { AxisLandingPresentation } from "../model/axisLandingPresentation";
import { AxisLanding } from "./preview/AxisLanding";
import { EmptyPreview } from "./preview/EmptyPreview";
import { SmartFolderView } from "./preview/SmartFolderView";
import { WorkDetail } from "./preview/WorkDetail";

// ── Main ──────────────────────────────────────────────────────

type PreviewMode = "work" | "axis-landing" | "smart-folder" | "empty";

interface PreviewPaneProps {
  mode: PreviewMode;
  showNoResultsHint: boolean;
  axisLandingPresentation: AxisLandingPresentation;
  selectedWork: Work | null;
  smartFolder: SmartFolder | null;
  axisWorks: WorkSummary[];
  smartFolderWorks: WorkSummary[];
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onSelectWork: (id: string) => void;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
}

export default function PreviewPane({
  mode,
  showNoResultsHint,
  axisLandingPresentation,
  selectedWork,
  smartFolder,
  axisWorks,
  smartFolderWorks,
  playingTrackIndex,
  isPlaybackActive,
  onPlay,
  onResume,
  onSelectWork,
  tagSuggestions,
  isPatching,
  onPatchWork,
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
          onSelectWork={onSelectWork}
        />
      )}
      {mode === "smart-folder" && smartFolder && (
        <SmartFolderView sf={smartFolder} works={smartFolderWorks} />
      )}
      {mode === "empty" && <EmptyPreview showNoResultsHint={showNoResultsHint} />}
    </div>
  );
}
