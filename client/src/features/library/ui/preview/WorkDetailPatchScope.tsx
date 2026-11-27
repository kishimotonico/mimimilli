import { useRef } from "react";
import { flushSync } from "react-dom";
import { useSetAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import type { NormalizedTag, Work } from "@mimimilli/shared";
import type { ReadyLibraryViewState } from "../../model/useLibraryNavigation";
import { useLibraryWorkPatchMutations } from "../../model/useLibraryQueries";
import { useUnregisterWorkMutation } from "../../../../entities/work/model/workMutations";
import { deselectUnregisteredWorkAtom } from "../../../../entities/library/model/navigationActions";
import { neighborInCachedWorks } from "../../model/neighborInCachedWorks";
import { focusListAfterRemoval } from "../focusListEntry";
import { WorkDetail } from "./WorkDetail";

interface WorkDetailPatchScopeProps {
  work: Work;
  nav: ReadyLibraryViewState;
  searchQuery: string;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  tagSuggestions: string[];
  onTagClick: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  layout?: "pane" | "full";
  onExpand?: () => void;
  onGoToPlayingScreen?: () => void;
}

/** 作品単位で PATCH mutation を生成する。親で key={work.id} を付けてマウントし直すこと。 */
export function WorkDetailPatchScope({
  work,
  nav,
  searchQuery,
  ...rest
}: WorkDetailPatchScopeProps) {
  const workPatchMutations = useLibraryWorkPatchMutations(nav.view, searchQuery);
  const deleteMutation = useUnregisterWorkMutation();
  const queryClient = useQueryClient();
  const deselectUnregisteredWork = useSetAtom(deselectUnregisteredWorkAtom);
  const detailRootRef = useRef<HTMLDivElement>(null);

  // 作品が消えると詳細ごと︙も消える。繰り上がる隣の作品を確定時に決め、成功の直後に、選択を外して一覧を
  // 描き直し（404 起点の選択解除 useLibrarySelectionCleanup は非同期に後から走る）、隣の行へフォーカスを移す
  const prepareUnregister = (workId: string) => {
    const neighborId = neighborInCachedWorks(queryClient, nav.view, searchQuery, workId);
    return () => {
      // 描き直すと詳細は外れるので、フォーカスが詳細の中にあったかは描き直す前に求める
      const active = document.activeElement;
      const wasInDetail = active !== null && !!detailRootRef.current?.contains(active);
      flushSync(() => deselectUnregisteredWork(workId));
      focusListAfterRemoval(neighborId, wasInDetail);
    };
  };

  return (
    <div ref={detailRootRef} className="contents">
      <WorkDetail
        work={work}
        workPatchMutations={workPatchMutations}
        deleteMutation={deleteMutation}
        prepareUnregister={prepareUnregister}
        {...rest}
      />
    </div>
  );
}
