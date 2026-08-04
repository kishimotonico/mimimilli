import type { Work, WorkListItem, WorkPatch, SmartFolder } from "@mimimilli/shared";
import type { CollectionStatsDisplay, PreviewMode } from "../model/libraryPresentation";
import CollectionStatus from "./CollectionStatus";
import { CollectionPlaceholder } from "./preview/CollectionPlaceholder";
import { DiscoveryDashboard } from "./preview/DiscoveryDashboard";
import { SmartFolderView } from "./preview/SmartFolderView";
import { WorkCardGrid } from "./preview/WorkCard";
import { WorkDetail } from "./preview/WorkDetail";

// ── Main ──────────────────────────────────────────────────────

interface PreviewPaneProps {
  mode: PreviewMode;
  showNoResultsHint: boolean;
  /** mode==="home" のときに表示するライブラリ全体の統計 */
  homeStats: CollectionStatsDisplay;
  selectedWork: Work | null;
  /** mode==="work"だがselectedWorkがまだ無いとき（読み込み中/404以外のエラー）の状態。
   *  404は呼び出し元で選択解除されるため、isSelectedWorkError=trueはそれ以外の一時的な失敗のみ */
  isSelectedWorkLoading: boolean;
  isSelectedWorkError: boolean;
  onRetrySelectedWork?: () => void;
  smartFolder: SmartFolder | null;
  axisWorks: WorkListItem[];
  axisTotal?: number;
  smartFolderTotal?: number;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onTogglePlay: () => void;
  onSelectWork: (id: string) => void;
  onTagClick: (tag: string) => void;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
  onEditSmartFolder: (folder: SmartFolder) => void;
}

export default function PreviewPane({
  mode,
  showNoResultsHint,
  homeStats,
  selectedWork,
  isSelectedWorkLoading,
  isSelectedWorkError,
  onRetrySelectedWork,
  smartFolder,
  axisWorks,
  axisTotal,
  smartFolderTotal,
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
  onEditSmartFolder,
}: PreviewPaneProps) {
  const title =
    mode === "work"
      ? "詳細"
      : mode === "smart-folder"
        ? "スマートフォルダー"
        : mode === "home"
          ? "ホーム"
          : mode === "tag-results"
            ? "絞り込み結果"
            : "プレビュー";

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
      {mode === "tag-results" && (
        <div className="mle-prv__body">
          <div className="mle-sect">
            <span>タグの結果</span>
            <div className="mle-sect__rule" />
            {axisTotal != null && <span className="count">{axisTotal} 件</span>}
          </div>
          <WorkCardGrid works={axisWorks} onSelectWork={onSelectWork} />
        </div>
      )}
      {mode === "smart-folder" && smartFolder && (
        <SmartFolderView
          sf={smartFolder}
          total={smartFolderTotal}
          onEdit={() => onEditSmartFolder(smartFolder)}
        />
      )}
      {mode === "empty" &&
        (showNoResultsHint ? (
          <CollectionPlaceholder
            message="作品が見つかりません"
            hint="検索条件を変えてみてください"
          />
        ) : (
          <CollectionPlaceholder message="作品を選択してください" />
        ))}
    </div>
  );
}
