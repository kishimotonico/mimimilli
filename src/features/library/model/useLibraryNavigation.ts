// library feature のナビゲーション state フック。
// Jotai atom をラップし、setAxis・drillInto・drillBack・toggleTag などの
// ハイレベルな操作を提供する。
// atom が feature 外の Provider スコープにあるため、兄弟コンポーネントでも
// 同じ state を参照できる（例: AddressBar が addressPath を購読）。

import { useAtom, useAtomValue } from "jotai";
import { useCallback } from "react";
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
}

export function useLibraryView(): LibraryViewState & LibraryViewActions {
  const [activeAxis, setActiveAxis] = useAtom(activeAxisAtom);
  const [drillValue, setDrillValue] = useAtom(drillValueAtom);
  const [selectedTags, setSelectedTags] = useAtom(selectedTagsAtom);
  const [selectedWorkId, setSelectedWorkId] = useAtom(selectedWorkIdAtom);
  const [sort, setSort_] = useAtom(sortAtom);
  const addressPath = useAtomValue(addressPathAtom);

  const setAxis = useCallback((axis: AxisId) => {
    setActiveAxis(axis);
    setDrillValue(null);
    setSelectedTags([]);
    setSelectedWorkId(null);
  }, [setActiveAxis, setDrillValue, setSelectedTags, setSelectedWorkId]);

  const drillInto = useCallback((value: string) => {
    setDrillValue(value);
    setSelectedTags([]);
    setSelectedWorkId(null);
  }, [setDrillValue, setSelectedTags, setSelectedWorkId]);

  const drillBack = useCallback(() => {
    setDrillValue(null);
    setSelectedWorkId(null);
  }, [setDrillValue, setSelectedWorkId]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setSelectedWorkId(null);
  }, [setSelectedTags, setSelectedWorkId]);

  const clearTags = useCallback(() => {
    setSelectedTags([]);
    setSelectedWorkId(null);
  }, [setSelectedTags, setSelectedWorkId]);

  const selectWork = useCallback((id: string | null) => {
    setSelectedWorkId(id);
  }, [setSelectedWorkId]);

  const setSort = useCallback((s: SortId) => {
    setSort_(s);
  }, [setSort_]);

  return {
    activeAxis, drillValue, selectedTags, selectedWorkId, sort, addressPath,
    setAxis, drillInto, drillBack, toggleTag, clearTags, selectWork, setSort,
  };
}
