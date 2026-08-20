import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { ApiRequestError } from "../../../shared/api/http";
import {
  getDefaultPlaylistTrackCount,
  toWorkListItem,
  type NormalizedTag,
  type Work,
  type WorkListItem,
} from "@mimimilli/shared";
import { workDetailIdAtom } from "../../../entities/work/model/navigationAtoms";
import { getWork } from "../../../entities/work/api";
import { getAllTags } from "../../../entities/tag/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { useRootFolder } from "../../../entities/settings/useSettingsQuery";
import { replaceAppModeAtom, setAppModeAtom } from "../../../shared/model/appModeAtoms";
import {
  playerIsPlayingOrLoadingAtom,
  playingTrackIndexAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import {
  useLibraryWorkDeleteMutation,
  useLibraryWorkPatchMutations,
} from "../model/useLibraryQueries";
import { librarySearchQueryAtom } from "../../../entities/library/model/navigationAtoms";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { WorkDetail } from "./preview/WorkDetail";

interface WorkDetailPageProps {
  onPlay: (work: WorkListItem, trackIndex: number) => void;
  onResume: (work: Work) => void;
  onTogglePlay: () => void;
}

export default function WorkDetailPage({ onPlay, onResume, onTogglePlay }: WorkDetailPageProps) {
  const workId = useAtomValue(workDetailIdAtom);
  const rootFolder = useRootFolder();
  const searchQuery = useAtomValue(librarySearchQueryAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingTrackIndex = useAtomValue(playingTrackIndexAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const replaceAppMode = useSetAtom(replaceAppModeAtom);
  const nav = useLibraryNavigation();

  const workQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.detail(workId ?? ""),
    queryFn: () => getWork(workId!),
    enabled: workId !== null,
  });
  const tagsQuery = useQuery({ queryKey: TAG_QUERY_KEYS.all(), queryFn: getAllTags });
  const workPatchMutations = useLibraryWorkPatchMutations(nav, searchQuery);
  // 削除で詳細が無効化された結果の退避も、404と同じくreplaceで抜ける（下のuseEffect参照）。
  const deleteMutation = useLibraryWorkDeleteMutation(() => replaceAppMode("library"));

  // 削除済み作品などをURLで直接開いた場合、404を確認したらライブラリへ戻す（LibraryViewの
  // 選択解除と同じ考え方。ネットワーク断・5xx等の一時的な失敗では留まりエラー表示・再試行を出す）。
  // 現在の画面自体が無効なのでreplaceで退避する。pushだと「404→自動でlibraryへpush→
  // 戻るで404詳細に戻る→また自動push」のループになり、戻る操作で抜けられなくなる。
  useEffect(() => {
    if (workQuery.error instanceof ApiRequestError && workQuery.error.status === 404) {
      replaceAppMode("library");
    }
  }, [workQuery.error, replaceAppMode]);

  const work = workQuery.data ?? null;
  const isCurrentWorkPlaying = work !== null && playingWorkId === work.id;

  const handlePlay = useCallback(
    (trackIndex: number) => {
      if (work && rootFolder !== null) {
        onPlay(
          toWorkListItem({ ...work, trackCount: getDefaultPlaylistTrackCount(work) }, rootFolder),
          trackIndex,
        );
      }
    },
    [work, rootFolder, onPlay],
  );

  const handleResume = useCallback(() => {
    if (work) onResume(work);
  }, [work, onResume]);

  const handleTagClick = useCallback(
    (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => {
      if (opts.ctrlKey || opts.metaKey) nav.addTag(tag);
      else nav.replaceTag(tag);
      setAppMode("library");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nav は毎レンダー新規オブジェクトのため参照する値だけに依存を絞る
    [nav.addTag, nav.replaceTag, setAppMode],
  );

  const handleGoToPlayingScreen = useCallback(() => setAppMode("nowPlaying"), [setAppMode]);

  if (!work) {
    return (
      <div className="mx-auto flex h-full max-w-[880px] flex-col px-10 py-10">
        {workQuery.isPending ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : (
          <CollectionStatus variant="list" kind="error" onRetry={workQuery.refetch} />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto h-full w-full max-w-[880px] overflow-y-auto">
      <WorkDetail
        work={work}
        layout="full"
        onPlay={handlePlay}
        onResume={handleResume}
        onTogglePlay={onTogglePlay}
        playingTrackIndex={isCurrentWorkPlaying ? (playingTrackIndex ?? null) : null}
        isPlaybackActive={isPlaybackActive}
        tagSuggestions={tagsQuery.data ?? []}
        workPatchMutations={workPatchMutations}
        deleteMutation={deleteMutation}
        onTagClick={handleTagClick}
        onGoToPlayingScreen={isCurrentWorkPlaying ? handleGoToPlayingScreen : undefined}
      />
    </div>
  );
}
