// library feature のナビゲーション state フック。
// Jotai atom をラップし、setAxis・drillInto・drillBack・toggleTag などの
// ハイレベルな操作を提供する。
// atom が feature 外の Provider スコープにあるため、兄弟コンポーネントでも
// 同じ state を参照できる（例: AddressBar が addressPath を購読）。

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { requestNavigationHistoryCommitAtom } from "../../navigation/model/navigationHistoryAtoms";
import type { AxisId, SortId } from "../model/types";
import {
  activeAxisAtom,
  drillValueAtom,
  selectedTagsAtom,
  selectedWorkIdAtom,
  sortAtom,
  addressPathAtom,
} from "./atoms";

export interface LibraryViewState {
  activeAxis: AxisId;
  drillValue: string | null;
  selectedTags: string[];
  selectedWorkId: string | null;
  sort: SortId;
  addressPath: string[];
}

export interface LibraryViewActions {
  setAxis: (axis: AxisId) => void;
  drillInto: (value: string) => void;
  drillBack: () => void;
  toggleTag: (tag: string) => void;
  clearTags: () => void;
  selectWork: (id: string | null) => void;
  setSort: (sort: SortId) => void;
  goToSegment: (index: number) => void;
}

export function useLibraryView(): LibraryViewState & LibraryViewActions {
  const [activeAxis, setActiveAxis] = useAtom(activeAxisAtom);
  const [drillValue, setDrillValue] = useAtom(drillValueAtom);
  const [selectedTags, setSelectedTags] = useAtom(selectedTagsAtom);
  const [selectedWorkId, setSelectedWorkId] = useAtom(selectedWorkIdAtom);
  const [sort, setSort_] = useAtom(sortAtom);
  const addressPath = useAtomValue(addressPathAtom);
  const requestCommit = useSetAtom(requestNavigationHistoryCommitAtom);

  const setAxis = useCallback((axis: AxisId) => {
    requestCommit("push");
    setActiveAxis(axis);
    setDrillValue(null);
    setSelectedTags([]);
    setSelectedWorkId(null);
  }, [requestCommit, setActiveAxis, setDrillValue, setSelectedTags, setSelectedWorkId]);

  const drillInto = useCallback((value: string) => {
    requestCommit("push");
    setDrillValue(value);
    setSelectedTags([]);
    setSelectedWorkId(null);
  }, [requestCommit, setDrillValue, setSelectedTags, setSelectedWorkId]);

  const drillBack = useCallback(() => {
    requestCommit("push");
    setDrillValue(null);
    setSelectedWorkId(null);
  }, [requestCommit, setDrillValue, setSelectedWorkId]);

  const toggleTag = useCallback((tag: string) => {
    requestCommit("push");
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setSelectedWorkId(null);
  }, [requestCommit, setSelectedTags, setSelectedWorkId]);

  const clearTags = useCallback(() => {
    requestCommit("push");
    setSelectedTags([]);
    setSelectedWorkId(null);
  }, [requestCommit, setSelectedTags, setSelectedWorkId]);

  const selectWork = useCallback((id: string | null) => {
    // 詳細パネルの開閉は同一ビュー内の選択なので履歴を増やさない。
    requestCommit("replace");
    setSelectedWorkId(id);
  }, [requestCommit, setSelectedWorkId]);

  const setSort = useCallback((s: SortId) => {
    requestCommit("replace");
    setSort_(s);
  }, [requestCommit, setSort_]);

  const goToSegment = useCallback((index: number) => {
    if (index <= 0) {
      if (activeAxis !== "all") setAxis("all");
      return;
    }
    if (index === 1 && drillValue !== null) drillBack();
  }, [activeAxis, drillBack, drillValue, setAxis]);

  return {
    activeAxis, drillValue, selectedTags, selectedWorkId, sort, addressPath,
    setAxis, drillInto, drillBack, toggleTag, clearTags, selectWork, setSort, goToSegment,
  };
}
