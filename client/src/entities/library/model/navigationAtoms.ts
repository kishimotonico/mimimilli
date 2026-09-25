import { atom } from "jotai";
import { appRouteAtom } from "../../navigation/model/appRouteStore";

export const librarySearchQueryAtom = atom((get) => get(appRouteAtom).library.q ?? "");
export const activeAxisAtom = atom((get) => get(appRouteAtom).library.activeAxis);
// 軸の値選択（facet/tag 問わず）はすべてここへ入る（ADR-0012 §2）。
// year 軸のような組み込み軸は "year/2024" 形式の擬似タグとして同じ配列に載る。
export const selectedTagsAtom = atom((get) => get(appRouteAtom).library.selectedTags);
export const selectedWorkIdAtom = atom((get) => get(appRouteAtom).library.selectedWorkId);
export const sortAtom = atom((get) => get(appRouteAtom).library.sort);
