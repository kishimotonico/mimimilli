import { useEffect, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import type { AxisFacetItem, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../../../entities/library/types";
import { getAxisIcon, getAxisLabel } from "../../../entities/library/axisDefinitions";
import { buildAxisValueDisplayRows } from "../model/axisValueDisplayRows";
import { axisValueSortAtom, libraryTileSizeAtom, libraryViewModeAtom } from "../model/atoms";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
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
  isFacetLoading?: boolean;
  isFacetError?: boolean;
  isTagPrefixesError?: boolean;
  /** 値の選択。主クリックも Ctrl/Cmd+クリックもその値の作品一覧へ進む（ADR-0041） */
  onSelectValue: (value: string) => void;
  onRetryFacets?: () => void;
  onRetryTagPrefixes?: () => void;
}

export default function AxisValueList({
  axis,
  facetItems,
  tagPrefixes,
  isFacetLoading,
  isFacetError,
  isTagPrefixesError,
  onSelectValue,
  onRetryFacets,
  onRetryTagPrefixes,
}: AxisValueListProps) {
  const viewMode = useAtomValue(libraryViewModeAtom);
  const tileSize = useAtomValue(libraryTileSizeAtom);
  const [sort, setSort] = useAtom(axisValueSortAtom);

  // コンテキスト検索（ADR-0012 §6）: 表示中の値に対するクライアント側の絞り込み。
  // 全体検索（URL の q=）とは別 state で、URL には載せず軸切り替えでリセットする。
  const [contextQuery, setContextQuery] = useState("");
  useEffect(() => {
    setContextQuery("");
  }, [axis]);

  const rows = buildAxisValueDisplayRows(facetItems, contextQuery, sort);
  const fallbackIcon = getAxisIcon(axis);
  const axisLabel = getAxisLabel(axis, tagPrefixes);
  const resetKey = `${axis}:${sort.key}:${sort.direction}:${contextQuery}`;

  const handleSelect = (item: AxisFacetItem) => onSelectValue(item.value);

  const showSearchMiss = facetItems.length > 0 && rows.length === 0 && contextQuery.length > 0;

  return (
    <div className={`mle-col is-results is-axis-values ${viewMode === "grid" ? "is-grid" : ""}`}>
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
              <div className="mle-col__notice" role="status" aria-live="polite">
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
                <div className="mle-col__notice" role="status" aria-live="polite">
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
                axisLabel={axisLabel}
                rows={rows}
                tileSize={tileSize}
                fallbackIcon={fallbackIcon}
                resetKey={resetKey}
                onSelect={handleSelect}
              />
            ) : (
              <AxisValueRows
                axisLabel={axisLabel}
                rows={rows}
                sort={sort}
                onSortChange={setSort}
                fallbackIcon={fallbackIcon}
                resetKey={resetKey}
                onSelect={handleSelect}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
