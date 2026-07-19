import { useState } from "react";
import type { Work, WorkPatch } from "@mimimilli/shared";
import CoverImg from "../../../../entities/work/ui/CoverImg";
import { I } from "../../../../shared/ui/Icon";
import { formatDuration, formatTime } from "../../../../shared/lib/format";
import { WorkMetadataActions } from "./WorkMetadataActions";
import { WorkStatusWarnings } from "./WorkStatusWarnings";
import { WorkTagEditor } from "./WorkTagEditor";
import { WorkTrackList } from "./WorkTrackList";
import { WorkEditDialog } from "./WorkEditDialog";
import { WorkInfoDialog } from "./WorkInfoDialog";

interface WorkDetailProps {
  work: Work;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
}

export function WorkDetail({
  work,
  onPlay,
  onResume,
  playingTrackIndex,
  isPlaybackActive,
  tagSuggestions,
  isPatching,
  onPatchWork,
}: WorkDetailProps) {
  const playlist = work.playlists.find((p) => p.id === work.defaultPlaylistId) ?? work.playlists[0];
  const tracks = playlist?.tracks ?? [];
  const isPlayable = work.status === "ok";
  const hasResume =
    work.resumePosition > 0 && work.resumeTrackIndex >= 0 && work.resumeTrackIndex < tracks.length;
  const resumeTrack = hasResume ? tracks[work.resumeTrackIndex] : null;
  const resumeTime = formatTime(work.resumePosition);

  // 閲覧ビューに残るタグ編集とブックマーク更新は同じエラー表示スロットを共有する。
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const hasKickerWarning = work.status === "missing" || work.status === "error";

  return (
    <div className="mle-prv__body">
      <div className="mle-prv__hero">
        <div className="mle-prv__cover">
          <CoverImg
            id={work.id}
            title={work.title}
            hasCover={!!work.coverImage}
            size={140}
            radius={6}
          />
        </div>
        <div className="mle-prv__meta">
          {hasKickerWarning && (
            <div className="mle-prv__kicker">
              {work.status === "missing" && (
                <span className="warn">
                  <I.err size={11} /> ファイル欠損
                </span>
              )}
              {work.status === "error" && (
                <span className="warn">
                  <I.err size={11} /> メタ読み込みエラー
                </span>
              )}
            </div>
          )}
          <div className="mle-prv__title-row">
            <h2 className="mle-prv__title">{work.title}</h2>
          </div>
          {(work.totalDurationSec > 0 || tracks.length > 0) && (
            <div className="mle-prv__row">
              {tracks.length > 0 && <span>{tracks.length} トラック</span>}
              {work.totalDurationSec > 0 && (
                <>
                  <span className="dot">·</span>
                  <span>{formatDuration(work.totalDurationSec)}</span>
                </>
              )}
            </div>
          )}
          <WorkTagEditor
            work={work}
            tagSuggestions={tagSuggestions}
            isPatching={isPatching}
            onPatchWork={onPatchWork}
            onError={setEditError}
          />
          {editError && (
            <p className="mle-prv__edit-error" role="alert">
              {editError}
            </p>
          )}
          <WorkMetadataActions
            work={work}
            onPlay={onPlay}
            onResume={onResume}
            hasResume={hasResume}
            isPlayable={isPlayable}
            resumeTrack={resumeTrack}
            resumeTime={resumeTime}
            isPatching={isPatching}
            onPatchWork={onPatchWork}
            onError={setEditError}
            onEdit={() => setIsEditDialogOpen(true)}
            onShowInfo={() => setIsInfoDialogOpen(true)}
          />
        </div>
      </div>

      <WorkStatusWarnings work={work} onEdit={() => setIsEditDialogOpen(true)} />

      <WorkTrackList
        tracks={tracks}
        isPlayable={isPlayable}
        playingTrackIndex={playingTrackIndex}
        isPlaybackActive={isPlaybackActive}
        hasResume={hasResume}
        resumeTrackIndex={work.resumeTrackIndex}
        resumePosition={work.resumePosition}
        onPlay={onPlay}
      />
      {isEditDialogOpen && (
        <WorkEditDialog
          work={work}
          tagSuggestions={tagSuggestions}
          isPatching={isPatching}
          onPatchWork={onPatchWork}
          onClose={() => setIsEditDialogOpen(false)}
        />
      )}
      {isInfoDialogOpen && (
        <WorkInfoDialog
          work={work}
          trackCount={tracks.length}
          hasResume={hasResume}
          resumeTrack={resumeTrack}
          resumeTime={resumeTime}
          onClose={() => setIsInfoDialogOpen(false)}
        />
      )}
    </div>
  );
}
