import type { CoverKind, Work } from "@mimimilli/shared";

/** 編集UI向けのカバー状態ラベル */
export function formatCoverEditLabel(work: Pick<Work, "coverKind" | "coverImage">): string {
  const image = work.coverImage;
  if (work.coverKind === "none" || image === null) return "なし";
  return work.coverKind === "unmeasured" ? `${image}（計測できません）` : image;
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
