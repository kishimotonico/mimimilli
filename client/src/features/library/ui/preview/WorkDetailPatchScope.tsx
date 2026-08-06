import type { NormalizedTag, Work } from "@mimimilli/shared";
import type { LibraryViewState } from "../../model/useLibraryNavigation";
import { useLibraryWorkPatchMutations } from "../../model/useLibraryQueries";
import { WorkDetail } from "./WorkDetail";

interface WorkDetailPatchScopeProps {
  work: Work;
  nav: LibraryViewState;
  searchQuery: string;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  onTogglePlay: () => void;
  playingTrackIndex: number | null;
  isPlaybackActive?: boolean;
  tagSuggestions: string[];
  onTagClick: (tag: NormalizedTag) => void;
}

/** 作品単位で PATCH mutation を生成する。親で key={work.id} を付けてマウントし直すこと。 */
export function WorkDetailPatchScope({
  work,
  nav,
  searchQuery,
  ...rest
}: WorkDetailPatchScopeProps) {
  const workPatchMutations = useLibraryWorkPatchMutations(nav, searchQuery);
  return <WorkDetail work={work} workPatchMutations={workPatchMutations} {...rest} />;
}
