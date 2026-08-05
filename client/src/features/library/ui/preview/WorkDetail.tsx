import { useState } from "react";
import type { NormalizedTag, Work, WorkPatchInput } from "@mimimilli/shared";
import CoverImg from "../../../../entities/work/ui/CoverImg";
import { selectFixedCoverThumbnailWidth } from "../../../../entities/work/ui/coverThumbnailWidth";
import {
  computeResumeProgressRatio,
  resumeProgressBarWidth,
} from "../../../../entities/work/resumeProgress";
import { I } from "../../../../shared/ui/Icon";
import { formatDuration, formatTime } from "../../../../shared/lib/format";
import { WorkMetadataActions } from "./WorkMetadataActions";
import { WorkPlayButton } from "./WorkPlayButton";
import { WorkStatusWarnings } from "./WorkStatusWarnings";
import { WorkTagEditor } from "./WorkTagEditor";
import { WorkTrackList } from "./WorkTrackList";
import { WorkEditDialog } from "./WorkEditDialog";
import { WorkInfoDialog } from "./WorkInfoDialog";

interface WorkDetailProps {
  work: Work;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onTogglePlay: () => void;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatchInput) => Promise<Work>;
  /** タグチップクリック時のハンドラ（タグ軸への絞り込み遷移） */
  onTagClick: (tag: NormalizedTag) => void;
}

export function WorkDetail({
  work,
  onPlay,
  onResume,
  onTogglePlay,
  playingTrackIndex,
  isPlaybackActive,
  tagSuggestions,
  isPatching,
  onPatchWork,
  onTagClick,
}: WorkDetailProps) {
  const playlist = work.playlists.find((p) => p.id === work.defaultPlaylistId) ?? work.playlists[0];
  const tracks = playlist?.tracks ?? [];
  const isPlayable = work.status === "ok";
  const resumePlaylist = work.resume
    ? work.playlists.find((candidate) => candidate.id === work.resume?.playlistId)
    : null;
  const resumeTrack = work.resume
    ? (resumePlaylist?.tracks.find((candidate) => candidate.id === work.resume?.trackId) ?? null)
    : null;
  const hasResume = work.resume !== null && work.resume.offsetSec > 0 && resumeTrack !== null;
  const resumeTime = formatTime(work.resume?.offsetSec ?? 0) ?? "0:00";
  // playingTrackIndexはLibraryView側で「選択中の作品と再生中の作品が一致するときだけ
  // 値を渡す」ガードが既にかかっている（一致しなければnull）ため、非nullは
  // そのまま「この作品がロード中」を意味する。isPlaybackActiveはそのガードが無いので
  // isLoadedと組み合わせて初めて「この作品が実際に再生中」を判定できる。
  const isLoaded = playingTrackIndex !== null;
  const isPlaying = isLoaded && Boolean(isPlaybackActive);
  const resumeProgressRatio = hasResume ? computeResumeProgressRatio(work) : null;

  // 閲覧ビューに残るタグ編集とブックマーク更新は同じエラー表示スロットを共有する。
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const hasKickerWarning = work.status === "missing" || work.status === "error";

  return (
    <div className="mle-prv__body">
      <div className="mle-prv__hero">
        <div className="mle-prv__coverwrap">
          <div className="mle-prv__cover">
            <CoverImg
              id={work.id}
              title={work.title}
              cover={work.cover}
              size={140}
              radius={6}
              requestWidth={selectFixedCoverThumbnailWidth(140, window.devicePixelRatio)}
            />
            {resumeProgressRatio !== null && (
              <div
                className="mle-prv__cover-progress"
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- ネイティブ<progress>はトラック/フィル色をクロスブラウザで自由に塗れないため、カバー画像に重ねる帯はdiv+role="progressbar"で実装する
                role="progressbar"
                aria-label="再開位置"
                aria-valuenow={Math.round(resumeProgressRatio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="mle-prv__cover-progress-fill"
                  style={{ width: resumeProgressBarWidth(resumeProgressRatio) }}
                />
              </div>
            )}
          </div>
          <WorkPlayButton
            hasResume={hasResume}
            isPlayable={isPlayable}
            isLoaded={isLoaded}
            isPlaying={isPlaying}
            resumeTrack={resumeTrack}
            resumeTime={resumeTime}
            onPlayFromStart={() => onPlay(0)}
            onResume={onResume}
            onTogglePlay={onTogglePlay}
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
            <h2 className="mle-prv__title" title={work.title}>
              {work.title}
            </h2>
          </div>
          {(tracks.length > 0 || (work.totalDurationSec !== null && work.totalDurationSec > 0)) && (
            <div className="mle-prv__row">
              {tracks.length > 0 && <span>{tracks.length} トラック</span>}
              <span className="dot">·</span>
              <span>
                {work.totalDurationSec !== null
                  ? (formatDuration(work.totalDurationSec) ?? "--:--")
                  : "--:--"}
              </span>
            </div>
          )}
          <WorkTagEditor
            work={work}
            tagSuggestions={tagSuggestions}
            isPatching={isPatching}
            onPatchWork={onPatchWork}
            onError={setEditError}
            onTagClick={onTagClick}
          />
          {editError && (
            <p className="mle-prv__edit-error" role="alert">
              {editError}
            </p>
          )}
          <WorkMetadataActions
            work={work}
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
        resumeTrackId={
          playlist?.id === work.resume?.playlistId ? (work.resume?.trackId ?? null) : null
        }
        resumeOffsetSec={work.resume?.offsetSec ?? 0}
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
