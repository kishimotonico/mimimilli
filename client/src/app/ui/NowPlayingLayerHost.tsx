import { useLibraryNavigation } from "../../features/library/model/useLibraryNavigation";
import NowPlayingLayer from "../../features/player/ui/NowPlayingLayer";

/** 層のタグの行き先は、プレビュー・作品詳細のタグと同じライブラリの遷移に任せる */
export default function NowPlayingLayerHost({
  onOpenWork,
}: {
  onOpenWork: (workId: string) => void;
}) {
  const { clickTag } = useLibraryNavigation();
  return <NowPlayingLayer onOpenWork={onOpenWork} onTagClick={clickTag} />;
}
