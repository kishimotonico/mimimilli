import { atom } from "jotai";
import { isBuiltinPseudoTagAxis, parseBuiltinAxisTag, type NormalizedTag } from "@mimimilli/shared";
import { requestNavigationHistoryCommit } from "../../navigation/model/navigationHistoryCommit";
import type { AxisId, SortId } from "./types";
import { computeResultsPaneKind } from "./libraryPresentation";
import { activeAxisAtom, selectedTagsAtom, selectedWorkIdAtom, sortAtom } from "./atoms";

// 軸は値をブラウズするためのビューであり、選択状態を持たない（ADR-0012 §1）。
// 軸を切り替えても選択中のフィルタ（selectedTagsAtom）は維持する。
export const setLibraryAxisAtom = atom(null, (_get, set, axis: AxisId) => {
  requestNavigationHistoryCommit(set, "push");
  set(activeAxisAtom, axis);
  set(selectedWorkIdAtom, null);
});

// 軸の値選択（facet/tag 問わず）はすべて同じタグフィルタへの追加・解除として扱う
// （ADR-0012 §2）。year のような単一選択の組み込み軸は、追加時に同じ軸の既存選択を
// 取り除いてから追加することで「新しい値が前の選択を置き換える」挙動にする。
export const toggleLibraryTagAtom = atom(null, (get, set, tag: NormalizedTag) => {
  requestNavigationHistoryCommit(set, "push");
  const prev = get(selectedTagsAtom);
  if (prev.includes(tag)) {
    set(
      selectedTagsAtom,
      prev.filter((t) => t !== tag),
    );
  } else {
    const builtin = parseBuiltinAxisTag(tag);
    const base =
      builtin && isBuiltinPseudoTagAxis(builtin.axis)
        ? prev.filter((t) => parseBuiltinAxisTag(t)?.axis !== builtin.axis)
        : prev;
    set(selectedTagsAtom, [...base, tag]);
  }
  set(selectedWorkIdAtom, null);
});

// 全入口共通の「追加ボタン」操作（ADR-0013）。冪等: 既に選択済みなら何もしない
// （履歴コミットも走らせない）。同軸排他・履歴コミット・selectedWorkIdクリアの扱いは
// toggleLibraryTagAtom の追加側と同じ。toggleLibraryTagAtom は解除と Ctrl/Cmd+クリックに
// よる反転の経路として引き続き使う（既に選択済みなら Ctrl/Cmd+クリックで解除できる）。
export const addLibraryTagAtom = atom(null, (get, set, tag: NormalizedTag) => {
  const prev = get(selectedTagsAtom);
  if (prev.includes(tag)) return;
  requestNavigationHistoryCommit(set, "push");
  const builtin = parseBuiltinAxisTag(tag);
  const base =
    builtin && isBuiltinPseudoTagAxis(builtin.axis)
      ? prev.filter((t) => parseBuiltinAxisTag(t)?.axis !== builtin.axis)
      : prev;
  set(selectedTagsAtom, [...base, tag]);
  set(selectedWorkIdAtom, null);
});

// 作品詳細のタグクリック用: 軸を tag に切り替えつつ絞り込みをそのタグだけに置き換える
// 単一のアクション（ADR-0012 §2）。setAxis → toggleTag の2段呼び出しは、既存の絞り込みへの
// 追加になってしまうほか、履歴コミットの二重化も招くため使わない。
export const selectSoleLibraryTagAtom = atom(null, (_get, set, tag: NormalizedTag) => {
  requestNavigationHistoryCommit(set, "push");
  set(activeAxisAtom, "tag");
  set(selectedTagsAtom, [tag]);
  set(selectedWorkIdAtom, null);
});

// 全入口共通の「既定=置き換え」操作（ADR-0013）。選択中のタグをすべて捨て、クリックした
// タグ1つだけの絞り込みにしてから、結果面を作品一覧へ進める。置き換えは「見たいものが
// 変わった」を表すため、結果面が値一覧/ホームのままなら作品一覧（all）へ切り替える。既に
// 作品一覧（ビュー軸・スマートフォルダー軸）ならそのまま維持する。軸レールのクイック
// オーバーレイ・チップの兄弟値ドロップダウン・値一覧の値タイル/行クリックが使う、入口を
// 問わない単一の規則。AND追加（Ctrl+クリック・ホバー時の＋ボタン等、「絞り込みを積んでいる
// 途中」を表す）は現在地に留まる toggleLibraryTagAtom を使う。
export const replaceLibraryTagAtom = atom(null, (get, set, tag: NormalizedTag) => {
  requestNavigationHistoryCommit(set, "push");
  set(selectedTagsAtom, [tag]);
  if (computeResultsPaneKind(get(activeAxisAtom)) !== "works") {
    set(activeAxisAtom, "all");
  }
  set(selectedWorkIdAtom, null);
});

export const clearLibraryTagsAtom = atom(null, (_get, set) => {
  requestNavigationHistoryCommit(set, "push");
  set(selectedTagsAtom, []);
  set(selectedWorkIdAtom, null);
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
