import { normalizeTags } from "@mimimilli/shared";
import type { DlsiteApplyBody, DlsiteWorkInfo, NormalizedTag, Work } from "@mimimilli/shared";

export function dlsiteInfoTags(info: DlsiteWorkInfo): NormalizedTag[] {
  return normalizeTags([
    ...(info.circle ? [`サークル/${info.circle}`] : []),
    ...info.cvs.map((cv) => `cv/${cv}`),
    ...info.genreTags.map((genre) => `genre/${genre}`),
  ]);
}

export function buildDlsiteApplyBody(
  info: DlsiteWorkInfo,
  selection: { applyTitle: boolean; applyCover: boolean; applyTags: string[] },
): DlsiteApplyBody {
  return {
    info,
    applyTitle: selection.applyTitle,
    applyCover: selection.applyCover,
    applyTags: normalizeTags(selection.applyTags),
  };
}

export function unappliedDlsiteTags(work: Work, info: DlsiteWorkInfo): NormalizedTag[] {
  // work.tags は既に正規化済み（NormalizedTag[]）。
  const existing = new Set(work.tags);
  return dlsiteInfoTags(info).filter((tag) => !existing.has(tag));
}
