import {
  IMAGE_PREVIEW_LIMIT_BYTES,
  PDF_PREVIEW_LIMIT_BYTES,
  TEXT_PREVIEW_LIMIT_BYTES,
  workspacePath,
  type FsListing,
  type MediaKind,
  type PreviewCapability,
  type WorkspacePath,
  type WorkspaceResourceRef,
} from "@mimimilli/shared";
import type { FsAdapter } from "../../adapter/fs.ts";
import { buildFsRoot } from "./data.ts";
import { normalizeFsPath, resolveFsDir, resolveFsPath } from "./fsResolve.ts";
import {
  DEFAULT_TRACK_DURATION_SEC,
  synthesizeSilentWav,
  synthesizeStaticContent,
} from "./media.ts";
import type { FixtureState } from "./state.ts";
import type { MediaAdapter } from "../../adapter/media.ts";

export function createFsMethods(
  state: FixtureState,
): FsAdapter & Pick<MediaAdapter, "locateWorkspaceMedia"> {
  const metadata = (node: {
    fileType: string;
    size: number;
  }): { mediaKind: MediaKind; preview: PreviewCapability } => {
    const mediaKind: MediaKind = ["wav", "mp3"].includes(node.fileType)
      ? "audio"
      : node.fileType === "image"
        ? "image"
        : node.fileType === "pdf"
          ? "pdf"
          : node.fileType === "text"
            ? "text"
            : node.fileType === "video"
              ? "video"
              : "other";
    if (mediaKind === "text" && node.size > TEXT_PREVIEW_LIMIT_BYTES)
      return { mediaKind, preview: { kind: "truncated", limitBytes: TEXT_PREVIEW_LIMIT_BYTES } };
    const limit =
      mediaKind === "image"
        ? IMAGE_PREVIEW_LIMIT_BYTES
        : mediaKind === "pdf"
          ? PDF_PREVIEW_LIMIT_BYTES
          : undefined;
    return {
      mediaKind,
      preview:
        limit !== undefined && node.size > limit
          ? { kind: "unavailable", reason: "size-limit" }
          : mediaKind === "other"
            ? { kind: "unavailable", reason: "unsupported" }
            : { kind: "available" },
    };
  };
  return {
    async browseFs(path?: WorkspacePath): Promise<FsListing | null> {
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const target = path ? `${rootAbs}/${path}` : rootAbs;

      const root = buildFsRoot(state.works, state.coverColumns);
      const dir = resolveFsDir(root, rootAbs, target);
      if (!dir) return null;

      const parent =
        target === rootAbs ? null : target.slice(0, target.lastIndexOf("/")) || rootAbs;

      return {
        path: path ?? null,
        parent:
          parent === null || parent === rootAbs
            ? null
            : workspacePath(parent.slice(rootAbs.length + 1)),
        workId: dir.workId,
        entries: dir.children.map((c) => ({
          name: c.name,
          path: workspacePath(`${path ? `${path}/` : ""}${c.name}`),
          isDir: c.isDir,
          size: c.size,
          fileType: c.fileType,
          childCount: c.isDir ? c.children.length : 0,
          workId: c.workId,
          workRelPath: c.workRelPath,
          ...(c.isDir ? { mediaKind: null, preview: null } : metadata(c)),
        })),
      };
    },

    async locateWorkspaceMedia(ref: WorkspaceResourceRef) {
      const rootAbs = normalizeFsPath(state.rootFolder ?? "/library");
      const target = `${rootAbs}/${ref.path}`;
      const root = buildFsRoot(state.works, state.coverColumns);
      const node = resolveFsPath(root, rootAbs, target);
      if (!node || node.isDir) return null;
      const result = metadata(node);
      const location =
        result.mediaKind === "audio"
          ? synthesizeSilentWav(DEFAULT_TRACK_DURATION_SEC)
          : result.mediaKind === "image"
            ? synthesizeStaticContent("fixture image", "image/svg+xml")
            : result.mediaKind === "pdf"
              ? synthesizeStaticContent("%PDF-1.4\nfixture\n", "application/pdf")
              : result.mediaKind === "video"
                ? synthesizeStaticContent("fixture video", "video/mp4")
                : synthesizeStaticContent(
                    "fixture text\n".repeat(Math.ceil(node.size / 13)),
                    "text/plain; charset=utf-8",
                  );
      return {
        location,
        ...result,
        maxBytes: result.mediaKind === "text" ? TEXT_PREVIEW_LIMIT_BYTES : undefined,
      };
    },
  };
}
