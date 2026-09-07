import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { buildLibraryAddressPath } from "../model/atoms";
import { activeAxisAtom } from "../../../entities/library/model/navigationAtoms";
import { goToLibrarySegmentAtom } from "../../../entities/library/model/navigationActions";
import { useLibraryTransition } from "../model/useLibraryNavigation";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { listSmartFolders } from "../../../entities/smart-folder/api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";

export default function LibraryBreadcrumbs() {
  const activeAxis = useAtomValue(activeAxisAtom);
  const { tagPrefixes } = useTagPrefixes();
  const smartFoldersQuery = useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.all(),
    queryFn: listSmartFolders,
  });
  const path = buildLibraryAddressPath(activeAxis, tagPrefixes, smartFoldersQuery.data ?? []);
  const goToSegmentAtom = useSetAtom(goToLibrarySegmentAtom);
  const startTransition = useLibraryTransition();
  const goToSegment = (index: number) => startTransition(() => goToSegmentAtom(index));

  return <Breadcrumbs path={path} onNavigate={goToSegment} />;
}
