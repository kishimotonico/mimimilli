import { useState, useCallback } from "react";
import type { AxisId, SortId } from "../types";

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

function buildAddressPath(axis: AxisId, drillValue: string | null): string[] {
  const axisLabels: Partial<Record<string, string>> = {
    all: "すべての作品", recent: "最近再生", added: "最近追加",
    fav: "お気に入り", unplayed: "未再生", missing: "ファイル欠損",
    circle: "サークル", cv: "CV", series: "シリーズ",
    cat: "カテゴリ", tag: "タグ", year: "追加日",
  };
  const label = axis.startsWith("smart-")
    ? "スマートフォルダー"
    : (axisLabels[axis] ?? axis);
  const base = ["ライブラリ", label];
  return drillValue ? [...base, drillValue] : base;
}

const INITIAL_STATE: LibraryViewState = {
  activeAxis: "all",
  drillValue: null,
  selectedTags: [],
  selectedWorkId: null,
  sort: "added-desc",
  addressPath: ["ライブラリ", "すべての作品"],
};

export function useLibraryView(): LibraryViewState & LibraryViewActions {
  const [state, setState] = useState<LibraryViewState>(INITIAL_STATE);

  const setAxis = useCallback((axis: AxisId) => {
    setState((s) => ({
      ...s,
      activeAxis: axis,
      drillValue: null,
      selectedTags: [],
      selectedWorkId: null,
      addressPath: buildAddressPath(axis, null),
    }));
  }, []);

  const drillInto = useCallback((value: string) => {
    setState((s) => ({
      ...s,
      drillValue: value,
      selectedWorkId: null,
      addressPath: buildAddressPath(s.activeAxis, value),
    }));
  }, []);

  const drillBack = useCallback(() => {
    setState((s) => ({
      ...s,
      drillValue: null,
      selectedWorkId: null,
      addressPath: buildAddressPath(s.activeAxis, null),
    }));
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setState((s) => ({
      ...s,
      selectedTags: s.selectedTags.includes(tag)
        ? s.selectedTags.filter((t) => t !== tag)
        : [...s.selectedTags, tag],
      selectedWorkId: null,
    }));
  }, []);

  const clearTags = useCallback(() => {
    setState((s) => ({ ...s, selectedTags: [], selectedWorkId: null }));
  }, []);

  const selectWork = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedWorkId: id }));
  }, []);

  const setSort = useCallback((sort: SortId) => {
    setState((s) => ({ ...s, sort }));
  }, []);

  return { ...state, setAxis, drillInto, drillBack, toggleTag, clearTags, selectWork, setSort };
}
