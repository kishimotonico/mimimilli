import { atom } from "jotai";
import { requestNavigationHistoryCommit } from "../../navigation/model/navigationHistoryCommit";
import type { AxisId, SortId } from "./types";
import {
  activeAxisAtom,
  gridInspectorOpenAtom,
  selectedTagsAtom,
  selectedWorkIdAtom,
  sortAtom,
} from "./atoms";

// 軸は値をブラウズするためのビューであり、選択状態を持たない（ADR-0012 §1）。
// 軸を切り替えても選択中のフィルタ（selectedTagsAtom）は維持する。
export const setLibraryAxisAtom = atom(null, (_get, set, axis: AxisId) => {
  requestNavigationHistoryCommit(set, "push");
  set(activeAxisAtom, axis);
  set(selectedWorkIdAtom, null);
  set(gridInspectorOpenAtom, false);
});

// 軸の値選択（facet/tag 問わず）はすべて同じタグフィルタへの追加・解除として扱う
// （ADR-0012 §2）。
export const toggleLibraryTagAtom = atom(null, (get, set, tag: string) => {
  requestNavigationHistoryCommit(set, "push");
  const prev = get(selectedTagsAtom);
  set(selectedTagsAtom, prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  set(selectedWorkIdAtom, null);
  set(gridInspectorOpenAtom, false);
});

export const clearLibraryTagsAtom = atom(null, (_get, set) => {
  requestNavigationHistoryCommit(set, "push");
  set(selectedTagsAtom, []);
  set(selectedWorkIdAtom, null);
  set(gridInspectorOpenAtom, false);
});

// 未選択→選択は push（戻るでドリル済み・未選択に戻れるように）、
// 選択→別作品への切替・選択→解除は replace（切替のたびに履歴が積まれないように）。
export const selectLibraryWorkAtom = atom(null, (get, set, id: string | null) => {
  const wasUnselected = get(selectedWorkIdAtom) === null;
  requestNavigationHistoryCommit(set, wasUnselected && id !== null ? "push" : "replace");
  set(selectedWorkIdAtom, id);
});

export const setLibrarySortAtom = atom(null, (_get, set, sort: SortId) => {
  requestNavigationHistoryCommit(set, "replace");
  set(sortAtom, sort);
});

export const goToLibrarySegmentAtom = atom(null, (get, set, index: number) => {
  const activeAxis = get(activeAxisAtom);
  if (index <= 0 && activeAxis !== "all") set(setLibraryAxisAtom, "all");
});
