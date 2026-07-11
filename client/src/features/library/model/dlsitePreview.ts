import { normalizeTags } from "@mimimilli/shared";
import type { DlsiteApplyBody, DlsiteWorkInfo, Work } from "@mimimilli/shared";

export function dlsiteInfoTags(info: DlsiteWorkInfo): string[] {
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

export function unappliedDlsiteTags(work: Work, info: DlsiteWorkInfo): string[] {
  const existing = new Set(normalizeTags(work.tags));
  return dlsiteInfoTags(info).filter((tag) => !existing.has(tag));
}
