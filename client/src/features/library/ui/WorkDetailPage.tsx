import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "../../../shared/api/http";
import type { NormalizedTag } from "@mimimilli/shared";
import { workDetailIdAtom } from "../../../entities/work/model/navigationAtoms";
import { workDetailQueryOptions } from "../../../entities/work/workDetailQueryOptions";
import { allTagsQueryOptions } from "../../../entities/tag/allTagsQueryOptions";
import {
  leaveMissingWorkDetailAtom,
  openNowPlayingLayerAtom,
} from "../../../entities/navigation/model/appRouteStore";
import {
  playerIsPlayingOrLoadingAtom,
  playingTrackIndexAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { useLibraryWorkPatchMutations } from "../model/useLibraryQueries";
import { useUnregisterWorkMutation } from "../../../entities/work/model/workMutations";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { WorkDetail } from "./preview/WorkDetail";
import { neighborInCachedWorks } from "../model/neighborInCachedWorks";

export default function WorkDetailPage() {
  const workId = useAtomValue(workDetailIdAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingTrackIndex = useAtomValue(playingTrackIndexAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const openNowPlaying = useSetAtom(openNowPlayingLayerAtom);
  const leaveMissingWorkDetail = useSetAtom(leaveMissingWorkDetailAtom);
  const queryClient = useQueryClient();
  const nav = useLibraryNavigation();
  const { clickTag } = nav;
  const view = nav.foldersStatus === "ready" ? nav.view : null;
  const searchQuery = nav.foldersStatus === "ready" ? nav.view.q : "";

  const workQuery = useQuery(workDetailQueryOptions(workId));
  const tagsQuery = useQuery(allTagsQueryOptions);
  const workPatchMutations = useLibraryWorkPatchMutations(view, searchQuery);
  const deleteMutation = useUnregisterWorkMutation();

  // 作品が存在しない（登録解除済み・URLで直接開いた削除済み作品）と404で確認したら、置き換えでライブラリへ戻る。
  // ネットワーク断・5xx等の一時的な失敗では留まりエラー表示・再試行を出す。
  useEffect(() => {
    if (
      workId !== null &&
      workQuery.error instanceof ApiRequestError &&
      workQuery.error.status === 404
    ) {
      leaveMissingWorkDetail(workId);
    }
  }, [workId, workQuery.error, leaveMissingWorkDetail]);

  const work = workQuery.data ?? null;
  const isCurrentWorkPlaying = work !== null && playingWorkId === work.id;

  const handleTagClick = useCallback(
    (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => clickTag(tag, opts),
    [clickTag],
  );

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
        playingTrackIndex={isCurrentWorkPlaying ? (playingTrackIndex ?? null) : null}
        isPlaybackActive={isPlaybackActive}
        tagSuggestions={tagsQuery.data ?? []}
        workPatchMutations={workPatchMutations}
        deleteMutation={deleteMutation}
        onTagClick={handleTagClick}
        onGoToPlayingScreen={isCurrentWorkPlaying ? openNowPlaying : undefined}
        neighborOf={(id) => neighborInCachedWorks(queryClient, view, searchQuery, id)}
      />
    </div>
  );
}
