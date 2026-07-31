import type { CoverKind, Work } from "@mimimilli/shared";

/** 編集UI向けのカバー状態ラベル */
export function formatCoverEditLabel(
  work: Pick<Work, "coverKind" | "coverImage" | "cover">,
): string {
  switch (work.coverKind) {
    case "none":
      return "なし";
    case "unmeasured":
      return `${work.coverImage}（計測できません）`;
    case "measured":
      return work.coverImage ?? work.cover!.image;
  }
}

/** 情報表示向けのカバー状態ラベル */
export function formatCoverInfoLabel(coverKind: CoverKind): string {
  switch (coverKind) {
    case "none":
      return "なし";
    case "unmeasured":
      return "あり（計測できません）";
    case "measured":
      return "あり";
  }
}
