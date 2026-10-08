import { useCallback, useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { ApiRequestError } from "../../../shared/api/http";
import type { NormalizedTag } from "@mimimilli/shared";
import { workDetailIdAtom } from "../../../entities/work/model/navigationAtoms";
import { workDetailQueryOptions } from "../../../entities/work/workDetailQueryOptions";
import { allTagsQueryOptions } from "../../../entities/tag/allTagsQueryOptions";
import {
  replaceAppModeAtom,
  setAppModeAtom,
} from "../../../entities/navigation/model/appRouteStore";
import {
  playerIsPlayingOrLoadingAtom,
  playingTrackIndexAtom,
  playingWorkIdAtom,
} from "../../../entities/player/model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { useLibraryWorkPatchMutations } from "../model/useLibraryQueries";
import { useUnregisterWorkMutation } from "../../../entities/work/model/workMutations";
import { librarySearchQueryAtom } from "../../../entities/library/model/navigationAtoms";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import { WorkDetail } from "./preview/WorkDetail";

export default function WorkDetailPage() {
  const workId = useAtomValue(workDetailIdAtom);
  const searchQuery = useAtomValue(librarySearchQueryAtom);
  const playingWorkId = useAtomValue(playingWorkIdAtom);
  const playingTrackIndex = useAtomValue(playingTrackIndexAtom);
  const isPlaybackActive = useAtomValue(playerIsPlayingOrLoadingAtom);
  const setAppMode = useSetAtom(setAppModeAtom);
  const replaceAppMode = useSetAtom(replaceAppModeAtom);
  const nav = useLibraryNavigation();

  const workQuery = useQuery(workDetailQueryOptions(workId));
  const tagsQuery = useQuery(allTagsQueryOptions);
  const workPatchMutations = useLibraryWorkPatchMutations(nav, searchQuery);
  const deleteMutation = useUnregisterWorkMutation();

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
        playingTrackIndex={isCurrentWorkPlaying ? (playingTrackIndex ?? null) : null}
        isPlaybackActive={isPlaybackActive}
        tagSuggestions={tagsQuery.data ?? []}
        workPatchMutations={workPatchMutations}
        deleteMutation={deleteMutation}
        // 解除後の退避も、404と同じくreplaceで抜ける（上のuseEffect参照）
        onUnregistered={() => replaceAppMode("library")}
        onTagClick={handleTagClick}
        onGoToPlayingScreen={isCurrentWorkPlaying ? handleGoToPlayingScreen : undefined}
      />
    </div>
  );
}
