import { useAtomValue, useSetAtom } from "jotai";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import { useRootFolder } from "../../../entities/settings/useSettingsQuery";
import { filesRelPathAtom } from "../../../entities/files/model/navigationAtoms";
import { goToFilesSegmentAtom } from "../model/filesNavigationActions";
import { rootLabel } from "../model/types";

export default function FilesBreadcrumbs() {
  const relPath = useAtomValue(filesRelPathAtom);
  const goToSegment = useSetAtom(goToFilesSegmentAtom);
  const rootFolder = useRootFolder() ?? "/";
  const path = [rootLabel(rootFolder), ...relPath];

  return <Breadcrumbs path={path} onNavigate={goToSegment} />;
}
