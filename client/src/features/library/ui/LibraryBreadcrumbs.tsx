import { useAtomValue, useSetAtom } from "jotai";
import Breadcrumbs from "../../../app/ui/Breadcrumbs";
import { addressPathAtom } from "../model/atoms";
import { goToLibrarySegmentAtom } from "../model/libraryNavigationActions";

export default function LibraryBreadcrumbs() {
  const path = useAtomValue(addressPathAtom);
  const goToSegment = useSetAtom(goToLibrarySegmentAtom);

  return <Breadcrumbs path={path} onNavigate={goToSegment} />;
}
