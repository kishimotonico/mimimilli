import type { FsListing } from "@mimimilli/shared";
import type { FsAdapter } from "../../adapter/fs.ts";
import { buildFsRoot } from "./data.ts";
import { isAudioFileType, normalizeFsPath, resolveFsDir, resolveFsPath } from "./fsResolve.ts";
import { DEFAULT_TRACK_DURATION_SEC, synthesizeSilentWav } from "./media.ts";
import type { FixtureState } from "./state.ts";
import type { MediaAdapter } from "../../adapter/media.ts";

export function createFsMethods(
  state: FixtureState,
): FsAdapter & Pick<MediaAdapter, "locateFsAudio"> {
  return {
    async browseFs(path?: string): Promise<FsListing | null> {
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const target = path ? normalizeFsPath(path) : rootAbs;

      const root = buildFsRoot(state.works, state.coverColumns);
      const dir = resolveFsDir(root, rootAbs, target);
      if (!dir) return null;

      const parent =
        target === rootAbs ? null : target.slice(0, target.lastIndexOf("/")) || rootAbs;

      return {
        path: target,
        parent,
        workId: dir.workId,
        entries: dir.children.map((c) => ({
          name: c.name,
          path: `${target}/${c.name}`,
          isDir: c.isDir,
          size: c.size,
          fileType: c.fileType,
          childCount: c.isDir ? c.children.length : 0,
          workId: c.workId,
          workRelPath: c.workRelPath,
        })),
      };
    },

    async locateFsAudio(absolutePath: string) {
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const target = normalizeFsPath(absolutePath);
      const root = buildFsRoot(state.works, state.coverColumns);
      const node = resolveFsPath(root, rootAbs, target);
      if (!node || node.isDir || !isAudioFileType(node.fileType)) return null;
      return synthesizeSilentWav(DEFAULT_TRACK_DURATION_SEC);
    },
  };
}
