// 「＋絞り込み」の軸（prefix・タグ・追加年）とチップのラベル・アイコン。
// ラベルは tag_prefixes の定義から引く（ADR-0005）。

import { resolveTagPrefix, type TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "./types";
import type { IconName } from "../../shared/ui/Icon";

const BUILTIN_AXIS_LABELS: Record<string, string> = {
  tag: "タグ",
  year: "追加日",
};

export function getAxisLabel(axis: AxisId, tagPrefixes: TagPrefix[] = []): string {
  const builtin = BUILTIN_AXIS_LABELS[axis];
  if (builtin) return builtin;
  return resolveTagPrefix(axis, tagPrefixes).label;
}

const PREFIX_ICONS: Record<string, IconName> = {
  cv: "user",
  サークル: "folder",
  シリーズ: "bookmark",
  カテゴリ: "list",
  genre: "list",
};

const BUILTIN_AXIS_ICONS: Record<string, IconName> = {
  tag: "filter",
  year: "refresh",
};

export function getAxisIcon(axis: AxisId): IconName {
  return BUILTIN_AXIS_ICONS[axis] ?? PREFIX_ICONS[axis] ?? "folder";
}

const SMART_FOLDER_ICONS: Record<string, IconName> = {
  all: "gridS",
  random: "refresh",
  recent: "refresh",
  added: "add",
  fav: "star",
  error: "err",
  "by-cv": "user",
  "by-circle": "folder",
  "by-series": "bookmark",
  "by-category": "list",
  "by-tag": "filter",
  "by-year": "refresh",
};

export function getSmartFolderIcon(id: string): IconName {
  return SMART_FOLDER_ICONS[id] ?? "gridS";
}

export interface FacetAxisRow {
  id: AxisId;
  name: string;
  icon: IconName;
}

/** 「＋絞り込み」の軸選択の行 = prefix 定義（定義順）＋ 組み込みの tag / year（ADR-0005） */
export function buildFacetAxisRows(tagPrefixes: TagPrefix[]): FacetAxisRow[] {
  const prefixRows = tagPrefixes.map((p) => ({
    id: p.prefix,
    name: p.label,
    icon: getAxisIcon(p.prefix),
  }));
  return [
    ...prefixRows,
    { id: "tag", name: "タグ", icon: getAxisIcon("tag") },
    { id: "year", name: "追加日", icon: getAxisIcon("year") },
  ];
}
