import { useAtomValue, useSetAtom } from "jotai";
import Breadcrumbs from "../../../app/ui/Breadcrumbs";
import { useRootFolder } from "../../settings/useSettingsQuery";
import { filesRelPathAtom } from "../model/atoms";
import { goToFilesSegmentAtom } from "../model/filesNavigationActions";
import { rootLabel } from "../model/types";

export default function FilesBreadcrumbs() {
  const relPath = useAtomValue(filesRelPathAtom);
  const goToSegment = useSetAtom(goToFilesSegmentAtom);
  const rootFolder = useRootFolder() ?? "/";
  const path = [rootLabel(rootFolder), ...relPath];

  return <Breadcrumbs path={path} onNavigate={goToSegment} />;
}
