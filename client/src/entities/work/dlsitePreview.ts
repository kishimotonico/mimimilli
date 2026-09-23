import { dedupeTags, dlsiteInfoTags, normalizeTags } from "@mimimilli/shared";
import type { DlsiteApplyBody, DlsiteWorkInfo, NormalizedTag, Work } from "@mimimilli/shared";
import { formatCoverEditLabel } from "../../shared/lib/coverLabel";

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

export function unappliedDlsiteTags(
  work: Pick<Work, "tags">,
  info: DlsiteWorkInfo,
): NormalizedTag[] {
  const existing = new Set(work.tags);
  return dlsiteInfoTags(info).filter((tag) => !existing.has(tag));
}

/** DLsite適用ダイアログの1行の状態。変更あり・変更なし・適用不可を区別する */
export type DlsiteFieldDiff =
  | { kind: "unchanged"; value: string }
  | { kind: "changed"; current: string; next: string }
  | { kind: "unavailable"; current: string; reason: string };

export interface DlsiteApplyDiff {
  title: DlsiteFieldDiff;
  url: DlsiteFieldDiff;
  cover: DlsiteFieldDiff;
  /** work にまだ無いタグ（チェックボックスで選ぶ対象） */
  newTags: NormalizedTag[];
  /** 既に work に付いているタグ（適用済みとして折りたたんで表示） */
  appliedTags: NormalizedTag[];
  hasChanges: boolean;
}

export function computeDlsiteApplyDiff(
  work: Pick<Work, "title" | "tags" | "urls" | "coverKind" | "coverImage" | "cover">,
  info: DlsiteWorkInfo,
): DlsiteApplyDiff {
  const currentUrl = work.urls.find((entry) => entry.url.includes("dlsite.com"))?.url ?? "";
  const title: DlsiteFieldDiff =
    work.title === info.title
      ? { kind: "unchanged", value: work.title }
      : { kind: "changed", current: work.title, next: info.title };
  const url: DlsiteFieldDiff =
    currentUrl === info.url
      ? { kind: "unchanged", value: currentUrl || "未設定" }
      : { kind: "changed", current: currentUrl || "未設定", next: info.url };
  const currentCoverLabel = formatCoverEditLabel(work);
  const cover: DlsiteFieldDiff = info.coverUrl
    ? { kind: "changed", current: currentCoverLabel, next: "DLsite画像" }
    : { kind: "unavailable", current: currentCoverLabel, reason: "DLsiteに画像がありません" };
  const newTags = unappliedDlsiteTags(work, info);
  const appliedTags = dlsiteInfoTags(info).filter((tag) => work.tags.includes(tag));
  return {
    title,
    url,
    cover,
    newTags,
    appliedTags,
    hasChanges:
      title.kind === "changed" ||
      url.kind === "changed" ||
      cover.kind === "changed" ||
      newTags.length > 0,
  };
}
