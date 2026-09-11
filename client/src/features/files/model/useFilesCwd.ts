// filesRelPathAtom から現在の WorkspacePath を計算する薄いフック。
// root を必要としないため、cwd だけ欲しい呼び出し側（FilePreviewWorkActionsなど）が単独で使える。

import { useAtomValue } from "jotai";
import { filesRelPathAtom } from "../../../entities/file-system/model/navigationAtoms";
import { workspacePath, type WorkspacePath } from "@mimimilli/shared";

export function useFilesCwd(): WorkspacePath {
  const relPath = useAtomValue(filesRelPathAtom);
  return workspacePath(relPath.join("/"));
}
