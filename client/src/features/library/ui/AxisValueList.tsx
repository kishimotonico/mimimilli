import React, { useEffect, useMemo, useRef } from "react";
import { parseTag } from "@mimimilli/shared";
import type { AxisFacetItem, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { getAxisLabel } from "../model/axisDefinitions";
import { buildFilterTag } from "../model/libraryPresentation";
import { groupTagFacetItems } from "../model/tagAxisGrouping";
import CollectionStatus from "./CollectionStatus";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";

// facet 軸・タグ軸の値一覧（ADR-0012 §1・§2）。軸は値をブラウズするためのビューであり、
// 選択状態を持たない。値の選択はすべて selectedTagsAtom への追加として扱う。
// 本タスクでは素朴な一覧のみ（grid/list・列ソート・仮想化・階層表現は TASK-181/183）。

interface AxisValueListProps {
  axis: AxisId;
  facetItems: AxisFacetItem[];
  tagPrefixes: TagPrefix[];
  selectedTags: string[];
  isFacetLoading?: boolean;
  isFacetError?: boolean;
  isTagPrefixesError?: boolean;
  onToggle: (tag: string) => void;
  onRetryFacets?: () => void;
  onRetryTagPrefixes?: () => void;
}

function useResetListScrollOnAxisChange(
  axis: AxisId,
  listRef: React.RefObject<HTMLDivElement | null>,
) {
  const prevAxisRef = useRef(axis);
  useEffect(() => {
    if (prevAxisRef.current === axis) return;
    prevAxisRef.current = axis;
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [axis, listRef]);
}

export default function AxisValueList({
  axis,
  facetItems,
  tagPrefixes,
  selectedTags,
  isFacetLoading,
  isFacetError,
  isTagPrefixesError,
  onToggle,
  onRetryFacets,
  onRetryTagPrefixes,
}: AxisValueListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  useResetListScrollOnAxisChange(axis, listRef);
  const isTagAxis = axis === "tag";
  const groups = useMemo(
    () => (isTagAxis ? groupTagFacetItems(facetItems, tagPrefixes) : null),
    [isTagAxis, facetItems, tagPrefixes],
  );

  return (
    <div className="mle-col is-results is-axis-values">
      <div className="mle-col__hd">
        <span>{getAxisLabel(axis, tagPrefixes)}</span>
        {!isFacetLoading && <span className="count">{facetItems.length} 件</span>}
      </div>
      <div ref={listRef} className="mle-col__list">
        {isFacetLoading ? (
          <CollectionStatus variant="list" kind="loading" />
        ) : isFacetError && facetItems.length === 0 ? (
          // キャッシュが無い＝初回取得失敗のときだけ一覧全体をエラー画面に置き換える。
          <CollectionStatus variant="list" kind="error" onRetry={onRetryFacets} />
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
            {isTagAxis &&
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
              <CollectionStatus variant="list" kind="empty" message="項目がありません" />
            ) : groups ? (
              groups.map((group) => (
                <div key={group.key || "__flat__"} className="mll-taggroup">
                  <div className="mll-axisgroup__hd">{group.label}</div>
                  {group.items.map((item) => (
                    <AxisValueRow
                      key={item.value}
                      label={parseTag(item.value).value}
                      count={item.count}
                      checked={selectedTags.includes(item.value)}
                      onToggle={() => onToggle(item.value)}
                    />
                  ))}
                </div>
              ))
            ) : (
              facetItems.map((item) => {
                const tag = buildFilterTag(axis, item.value);
                return (
                  <AxisValueRow
                    key={item.value}
                    label={item.value}
                    count={item.count}
                    checked={selectedTags.includes(tag)}
                    onToggle={() => onToggle(tag)}
                  />
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AxisValueRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`mll-tagrow ${checked ? "is-checked" : ""}`}
      aria-pressed={checked}
      onClick={onToggle}
    >
      <div className="check">
        {checked && <I.x size={9} style={{ transform: "rotate(45deg)" }} />}
      </div>
      <span className="nm">{label}</span>
      <span className="count">{count}</span>
    </button>
  );
}
