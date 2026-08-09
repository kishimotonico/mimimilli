import { useAtomValue } from "jotai";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { activeAxisAtom, buildLibraryAddressPath } from "../model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";

export default function LibraryBreadcrumbs() {
  const activeAxis = useAtomValue(activeAxisAtom);
  const { tagPrefixes } = useTagPrefixes();
  const path = buildLibraryAddressPath(activeAxis, tagPrefixes);
  const { goToSegment } = useLibraryNavigation();

  return <Breadcrumbs path={path} onNavigate={goToSegment} />;
}
