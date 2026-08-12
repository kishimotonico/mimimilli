import { dedupeTags, normalizeTags } from "@mimimilli/shared";
import type { DlsiteApplyBody, DlsiteWorkInfo, NormalizedTag, Work } from "@mimimilli/shared";

export function dlsiteInfoTags(info: DlsiteWorkInfo): NormalizedTag[] {
  return dedupeTags(
    normalizeTags([
      ...(info.circle ? [`サークル/${info.circle}`] : []),
      ...info.cvs.map((cv) => `cv/${cv}`),
      ...info.genreTags.map((genre) => `genre/${genre}`),
    ]),
  );
}

export function buildDlsiteApplyBody(
  info: DlsiteWorkInfo,
  selection: {
    sourceRevision: string;
    applyTitle: boolean;
    applyCover: boolean;
    applyUrl: boolean;
    applyTags: string[];
  },
): DlsiteApplyBody {
  return {
    info,
    sourceRevision: selection.sourceRevision,
    applyTitle: selection.applyTitle,
    applyCover: selection.applyCover,
    applyUrl: selection.applyUrl,
    applyTags: dedupeTags(normalizeTags(selection.applyTags)),
  };
}

export function buildDlsiteRegistrationBody(
  info: DlsiteWorkInfo,
  selection: { applyTitle: boolean; applyCover: boolean; applyUrl: boolean; applyTags: string[] },
) {
  const { sourceRevision: _sourceRevision, ...body } = buildDlsiteApplyBody(info, {
    ...selection,
    sourceRevision: "new-work",
  });
  return body;
}

export function unappliedDlsiteTags(work: Work, info: DlsiteWorkInfo): NormalizedTag[] {
  const existing = new Set(work.tags);
  return dlsiteInfoTags(info).filter((tag) => !existing.has(tag));
}
