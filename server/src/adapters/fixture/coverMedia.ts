import { createCoverValidators } from "../../adapter/index.ts";
import type { CoverDescriptor, MediaAdapter } from "../../adapter/media.ts";
import { buildFullWorkFromState, findTrackByFile } from "./playback.ts";
import { findWorkFile, isImagePath } from "./fsResolve.ts";
import {
  DEFAULT_TRACK_DURATION_SEC,
  synthesizeCoverSvg,
  synthesizeFilePlaceholderSvg,
  synthesizeFilePlaceholderText,
  synthesizeSilentWav,
} from "./media.ts";
import { coverColumnsOf, type FixtureState } from "./state.ts";

export function createCoverMediaMethods(
  state: FixtureState,
): Pick<MediaAdapter, "locateMedia" | "describeCover"> {
  return {
    async locateMedia(kind, workId, relPath) {
      const work = state.works.find((w) => w.id === workId);
      if (!work) return null;
      if (!relPath) return null;

      if (kind === "audio") {
        const fullWork = buildFullWorkFromState(state, work);
        const track = findTrackByFile(fullWork, relPath);
        if (!track) return null;
        return synthesizeSilentWav(track.durationSec ?? DEFAULT_TRACK_DURATION_SEC);
      }

      const node = findWorkFile(work, coverColumnsOf(state, work.id), relPath);
      if (!node) return null;
      if (isImagePath(relPath)) return synthesizeFilePlaceholderSvg(relPath);
      return synthesizeFilePlaceholderText(relPath);
    },

    async describeCover(workId: string, width?: number): Promise<CoverDescriptor | null> {
      const work = state.works.find((entry) => entry.id === workId);
      if (!work?.cover) return null;
      const location = synthesizeCoverSvg(work);
      if (location.type !== "synthetic") {
        throw new Error("fixtureのカバー画像はsynthetic MediaLocationである必要があります");
      }
      const validators = createCoverValidators(work.id, width, { size: location.size, mtimeMs: 0 });
      return {
        ...validators,
        async materialize() {
          return location;
        },
      };
    },
  };
}
