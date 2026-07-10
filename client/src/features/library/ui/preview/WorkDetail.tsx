import { useState } from "react";
import type { Work, WorkPatch } from "@mimimilli/shared";
import CoverImg from "../../../../entities/work/ui/CoverImg";
import { I } from "../../../../shared/ui/Icon";
import { formatDuration, formatTime } from "../../../../shared/lib/format";
import { formatDate } from "./format";
import { WorkMetadataActions } from "./WorkMetadataActions";
import { WorkStatusWarnings } from "./WorkStatusWarnings";
import { WorkTagEditor } from "./WorkTagEditor";
import { WorkTrackList } from "./WorkTrackList";

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
  const playlist =
    work.playlists.find((p) => p.name === (work.defaultPlaylist ?? "default")) ?? work.playlists[0];
  const tracks = playlist?.tracks ?? [];
  const isPlayable = work.status === "ok";
  const hasResume =
    work.resumePosition > 0 && work.resumeTrackIndex >= 0 && work.resumeTrackIndex < tracks.length;
  const resumeTrack = hasResume ? tracks[work.resumeTrackIndex] : null;
  const resumeTime = formatTime(work.resumePosition);

  // タグ編集・タイトル編集・ブックマークの3つの保存操作は同じエラー表示スロットを共有する。
  const [editError, setEditError] = useState<string | null>(null);

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
          <div className="mle-prv__kicker">
            {work.status === "ok" && <span className="reg">登録済</span>}
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
            <span className="inline-flex items-center gap-[3px] tracking-normal">
              <span className="font-sans text-[9.5px] text-ink-4">追加</span>
              <span className="font-mono text-[10px] text-ink-2">{formatDate(work.addedAt)}</span>
            </span>
            {work.lastPlayedAt && (
              <>
                <span className="text-ink-4">·</span>
                <span className="inline-flex items-center gap-[3px] tracking-normal">
                  <span className="font-sans text-[9.5px] text-ink-4">最終再生</span>
                  <span className="font-mono text-[10px] text-ink-2">
                    {formatDate(work.lastPlayedAt)}
                  </span>
                </span>
              </>
            )}
          </div>
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
          />
        </div>
      </div>

      <WorkStatusWarnings work={work} />

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
    </div>
  );
}
