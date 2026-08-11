import { atom } from "jotai";
import { createRandomSeed, type NormalizedTag } from "@mimimilli/shared";
import type { AxisId, SortId } from "../types";

// ライブラリ検索語。URLの q= パラメータへ同期する（useNavigationHistory）。localStorage には保存しない。
export const librarySearchQueryAtom = atom("");

export const activeAxisAtom = atom<AxisId>("all");
// 軸の値選択（facet/tag 問わず）はすべてここへ入る（ADR-0012 §2）。
// year 軸のような組み込み軸は "year/2024" 形式の擬似タグとして同じ配列に載る。
export const selectedTagsAtom = atom<NormalizedTag[]>([]);
export const selectedWorkIdAtom = atom<string | null>(null);
export const sortAtom = atom<SortId>("added-desc");
// sort=random の作品一覧が使う seed。URLへは同期しない。再シャッフル時に navigationActions から差し替える
export const randomSeedAtom = atom(createRandomSeed());
