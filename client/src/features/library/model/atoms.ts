// library feature の client/UI state。
// active axis・drill・tag filter・選択作品など、API 由来でない操作状態を Jotai atom で管理する。
// previewMode のような「UI state と server state 両方に依存する派生」はここに置かず、
// コンポーネント側で useQuery 結果と atom 値を組み合わせて計算する（issue 参照）。

import { atom } from "jotai";
import type { AxisId, SortId } from "../../../features/library/model/types";

// ── ナビゲーション state ──────────────────────────────────────

export const activeAxisAtom = atom<AxisId>("all");
export const drillValueAtom = atom<string | null>(null);
export const selectedTagsAtom = atom<string[]>([]);
export const selectedWorkIdAtom = atom<string | null>(null);
export const sortAtom = atom<SortId>("added-desc");

// ── 派生: アドレスバーパス ────────────────────────────────────

const AXIS_LABELS: Partial<Record<string, string>> = {
  all: "すべての作品", recent: "最近再生", added: "最近追加",
  fav: "お気に入り", unplayed: "未再生", missing: "ファイル欠損",
  circle: "サークル", cv: "CV", series: "シリーズ",
  cat: "カテゴリ", tag: "タグ", year: "追加日",
};

function buildAddressPath(axis: AxisId, drillValue: string | null): string[] {
  if (axis === "all") return ["ライブラリ"];
  const label = (axis as string).startsWith("smart-")
    ? "スマートフォルダー"
    : (AXIS_LABELS[axis] ?? axis);
  const base = ["ライブラリ", label];
  return drillValue ? [...base, drillValue] : base;
}

export const addressPathAtom = atom<string[]>((get) => {
  return buildAddressPath(get(activeAxisAtom), get(drillValueAtom));
});
