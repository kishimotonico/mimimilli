import { useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { AxisFacetItem, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { getAxisIcon, getAxisLabel } from "../model/axisDefinitions";
import { buildFilterTag } from "../model/libraryPresentation";
import { filterAxisValueItems } from "../model/axisValueFilter";
import { sortAxisValueItems } from "../model/axisValueSort";
import { buildAxisValueHierarchy, flattenAxisValueRows } from "../model/axisValueHierarchy";
import { axisValueSortAtom, libraryTileSizeAtom, libraryViewModeAtom } from "../model/atoms";
import CollectionStatus from "./CollectionStatus";
import AxisValueRows from "./AxisValueRows";
import AxisValueGrid from "./AxisValueGrid";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";

// 軸の値一覧の本実装（ADR-0012 §5）。grid/list はユーザーの libraryViewModeAtom に
// 従い、値のソートは axisValueSortAtom（ソートメニュー・list列見出しの二重入口・単一state。
// ADR-0012 帰結）。入れ子タグ（スラッシュ複数）は名前順ソートのときだけ階層表示にし、
// 件数・総時間ソートではフルパスの平坦表示にフォールバックする（axisValueHierarchy.ts）。

interface AxisValueListProps {
  axis: AxisId;
  facetItems: AxisFacetItem[];
  tagPrefixes: TagPrefix[];
  selectedTags: string[];
  isFacetLoading?: boolean;
  isFacetError?: boolean;
  isTagPrefixesError?: boolean;
  /** 既定=置き換え（クリック。ADR-0012 §7） */
  onReplace: (tag: string) => void;
  /** AND追加（Ctrl/Cmd+クリック・ホバー時の＋ボタン） */
  onToggle: (tag: string) => void;
  onRetryFacets?: () => void;
  onRetryTagPrefixes?: () => void;
}

export default function AxisValueList({
  axis,
  facetItems,
  tagPrefixes,
  selectedTags,
  isFacetLoading,
  isFacetError,
  isTagPrefixesError,
  onReplace,
  onToggle,
  onRetryFacets,
  onRetryTagPrefixes,
}: AxisValueListProps) {
  const viewMode = useAtomValue(libraryViewModeAtom);
  const tileSize = useAtomValue(libraryTileSizeAtom);
  const [sort, setSort] = useAtom(axisValueSortAtom);

  // コンテキスト検索（ADR-0012 §6）: 表示中の値に対するクライアント側の絞り込み。
  // librarySearchQueryAtom（全体検索・URL の q=）とは別 state で、URL には載せず軸切り替えでリセットする。
  const [contextQuery, setContextQuery] = useState("");
  useEffect(() => {
    setContextQuery("");
  }, [axis]);

  const filtered = filterAxisValueItems(facetItems, contextQuery);
  const rows =
    sort.key === "name"
      ? buildAxisValueHierarchy(filtered, sort.direction)
      : flattenAxisValueRows(sortAxisValueItems(filtered, sort));
  const fallbackIcon = getAxisIcon(axis);
  const resetKey = `${axis}:${sort.key}:${sort.direction}:${contextQuery}`;

  const isSelected = (item: AxisFacetItem) =>
    selectedTags.includes(buildFilterTag(axis, item.value));
  // クリック＝置き換え、Ctrl/Cmd+クリック＝AND追加（ADR-0012 §7）。ホバー時の＋ボタンは常にAND追加。
  const handleSelect = (item: AxisFacetItem, opts: { ctrlKey: boolean; metaKey: boolean }) => {
    const tag = buildFilterTag(axis, item.value);
    if (opts.ctrlKey || opts.metaKey) onToggle(tag);
    else onReplace(tag);
  };
  const handleAdd = (item: AxisFacetItem) => onToggle(buildFilterTag(axis, item.value));

  const showSearchMiss = facetItems.length > 0 && filtered.length === 0;

  return (
    <div className={`mle-col is-results is-axis-values ${viewMode === "grid" ? "is-grid" : ""}`}>
      <div className="mle-col__hd">
        <span>{getAxisLabel(axis, tagPrefixes)}</span>
        {!isFacetLoading && <span className="count">{facetItems.length} 件</span>}
      </div>

      <div className="mll-vsearch">
        <I.search size={13} />
        <input
          type="text"
          value={contextQuery}
          onChange={(e) => setContextQuery(e.target.value)}
          placeholder="値を絞り込み"
          aria-label={`${getAxisLabel(axis, tagPrefixes)}の値を絞り込み`}
        />
        {contextQuery && (
          <Button variant="ghost" icon={I.x} onClick={() => setContextQuery("")}>
            クリア
          </Button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {isFacetLoading ? (
          <CollectionStatus variant={viewMode === "grid" ? "grid" : "list"} kind="loading" />
        ) : isFacetError && facetItems.length === 0 ? (
          // キャッシュが無い＝初回取得失敗のときだけ一覧全体をエラー画面に置き換える。
          <CollectionStatus
            variant={viewMode === "grid" ? "grid" : "list"}
            kind="error"
            onRetry={onRetryFacets}
          />
        ) : (
          <>
            {isFacetError && (
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role="status"で非ブロッキング通知にする
              <div className="mll-axis-error" role="status" aria-live="polite">
                <span>{getAxisLabel(axis, tagPrefixes)}の取得に失敗しました</span>
                {onRetryFacets && (
                  <Button variant="ghost" icon={I.refresh} onClick={onRetryFacets}>
                    再試行
                  </Button>
                )}
              </div>
            )}
            {axis === "tag" &&
              isTagPrefixesError && (
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role="status"で非ブロッキング通知にする
                <div className="mll-axis-error" role="status" aria-live="polite">
                  <span>分類軸の取得に失敗しました</span>
                  {onRetryTagPrefixes && (
                    <Button variant="ghost" icon={I.refresh} onClick={onRetryTagPrefixes}>
                      再試行
                    </Button>
                  )}
                </div>
              )}
            {facetItems.length === 0 ? (
              <CollectionStatus
                variant={viewMode === "grid" ? "grid" : "list"}
                kind="empty"
                message="項目がありません"
              />
            ) : showSearchMiss ? (
              <CollectionStatus
                variant={viewMode === "grid" ? "grid" : "list"}
                kind="empty"
                message="該当する値がありません"
                action={
                  <Button variant="ghost" icon={I.x} onClick={() => setContextQuery("")}>
                    絞り込みをクリア
                  </Button>
                }
              />
            ) : viewMode === "grid" ? (
              <AxisValueGrid
                rows={rows}
                tileSize={tileSize}
                isSelected={isSelected}
                fallbackIcon={fallbackIcon}
                resetKey={resetKey}
                onSelect={handleSelect}
                onAdd={handleAdd}
              />
            ) : (
              <AxisValueRows
                rows={rows}
                sort={sort}
                onSortChange={setSort}
                isSelected={isSelected}
                fallbackIcon={fallbackIcon}
                resetKey={resetKey}
                onSelect={handleSelect}
                onAdd={handleAdd}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
