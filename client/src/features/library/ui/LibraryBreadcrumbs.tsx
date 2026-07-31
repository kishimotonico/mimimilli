import { useAtomValue, useSetAtom } from "jotai";
import Breadcrumbs from "../../../app/ui/Breadcrumbs";
import { activeAxisAtom, drillValueAtom, buildLibraryAddressPath } from "../model/atoms";
import { goToLibrarySegmentAtom } from "../model/libraryNavigationActions";
import { useTagPrefixes } from "../model/useTagPrefixes";

export default function LibraryBreadcrumbs() {
  const activeAxis = useAtomValue(activeAxisAtom);
  const drillValue = useAtomValue(drillValueAtom);
  const { tagPrefixes } = useTagPrefixes();
  const path = buildLibraryAddressPath(activeAxis, drillValue, tagPrefixes);
  const goToSegment = useSetAtom(goToLibrarySegmentAtom);

  return <Breadcrumbs path={path} onNavigate={goToSegment} />;
}
