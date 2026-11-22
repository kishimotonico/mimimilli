import { useEffect, useState } from "react";
import { NO_AUTOFILL_PROPS } from "../../../shared/ui/noAutofill";
import { useAtom, useAtomValue } from "jotai";
import type { GroupBy, GroupValueItem, TagPrefix } from "@mimimilli/shared";
import { getGroupByIcon, getGroupByLabel } from "../../../entities/library/smartFolderDefinitions";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";
import { buildGroupValueDisplayRows } from "../model/groupValueDisplayRows";
import { groupValueSortAtom, libraryTileSizeAtom, libraryViewModeAtom } from "../model/atoms";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import GroupValueRows from "./GroupValueRows";
import GroupValueGrid from "./GroupValueGrid";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";

// グループの値一覧の本実装（ADR-0012 §5）。grid/list はユーザーの libraryViewModeAtom に
// 従い、値のソートは groupValueSortAtom（ソートメニュー・list列見出しの二重入口・単一state。
// ADR-0012 帰結）。入れ子タグ（スラッシュ複数）は名前順ソートのときだけ階層表示にし、
// 件数・総時間ソートではフルパスの平坦表示にフォールバックする（groupValueHierarchy.ts）。

interface GroupValueListProps {
  groupBy: GroupBy;
  groupValueItems: GroupValueItem[];
  tagPrefixes: TagPrefix[];
  isGroupValuesLoading?: boolean;
  isGroupValuesError?: boolean;
  isTagPrefixesError?: boolean;
  /** 値の選択。主クリックも Ctrl/Cmd+クリックもその値の作品一覧へ進む（ADR-0041） */
  onSelectValue: (value: string) => void;
  onRetryGroupValues?: () => void;
  onRetryTagPrefixes?: () => void;
}

export default function GroupValueList({
  groupBy,
  groupValueItems,
  tagPrefixes,
  isGroupValuesLoading,
  isGroupValuesError,
  isTagPrefixesError,
  onSelectValue,
  onRetryGroupValues,
  onRetryTagPrefixes,
}: GroupValueListProps) {
  const viewMode = useAtomValue(libraryViewModeAtom);
  const tileSize = useAtomValue(libraryTileSizeAtom);
  const [sort, setSort] = useAtom(groupValueSortAtom);

  // コンテキスト検索（ADR-0012 §6）: 表示中の値に対するクライアント側の絞り込み。
  // 全体検索（URL の q=）とは別 state で、URL には載せずグループ分けの切り替えでリセットする。
  const groupKey = groupByKey(groupBy);
  const [contextQuery, setContextQuery] = useState("");
  useEffect(() => {
    setContextQuery("");
  }, [groupKey]);

  const rows = buildGroupValueDisplayRows(groupValueItems, contextQuery, sort);
  const fallbackIcon = getGroupByIcon(groupBy);
  const groupByLabel = getGroupByLabel(groupBy, tagPrefixes);
  const resetKey = `${groupKey}:${sort.key}:${sort.direction}:${contextQuery}`;

  const handleSelect = (item: GroupValueItem) => onSelectValue(item.value);

  const showSearchMiss = groupValueItems.length > 0 && rows.length === 0 && contextQuery.length > 0;

  return (
    <div className={`mle-col is-results is-group-values ${viewMode === "grid" ? "is-grid" : ""}`}>
      <div className="mll-vsearch">
        <I.search size={13} />
        <input
          {...NO_AUTOFILL_PROPS}
          type="text"
          value={contextQuery}
          onChange={(e) => setContextQuery(e.target.value)}
          placeholder="値を絞り込み"
          aria-label={`${getGroupByLabel(groupBy, tagPrefixes)}の値を絞り込み`}
        />
        {contextQuery && (
          <Button variant="ghost" icon={I.x} onClick={() => setContextQuery("")}>
            クリア
          </Button>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {isGroupValuesLoading ? (
          <CollectionStatus variant={viewMode === "grid" ? "grid" : "list"} kind="loading" />
        ) : isGroupValuesError && groupValueItems.length === 0 ? (
          // キャッシュが無い＝初回取得失敗のときだけ一覧全体をエラー画面に置き換える。
          <CollectionStatus
            variant={viewMode === "grid" ? "grid" : "list"}
            kind="error"
            onRetry={onRetryGroupValues}
          />
        ) : (
          <>
            {isGroupValuesError && (
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role="status"で非ブロッキング通知にする
              <div className="mle-col__notice" role="status" aria-live="polite">
                <span>{getGroupByLabel(groupBy, tagPrefixes)}の取得に失敗しました</span>
                {onRetryGroupValues && (
                  <Button variant="ghost" icon={I.refresh} onClick={onRetryGroupValues}>
                    再試行
                  </Button>
                )}
              </div>
            )}
            {groupBy.kind === "tag" &&
              isTagPrefixesError && (
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- role="status"で非ブロッキング通知にする
                <div className="mle-col__notice" role="status" aria-live="polite">
                  <span>タグ設定の取得に失敗しました</span>
                  {onRetryTagPrefixes && (
                    <Button variant="ghost" icon={I.refresh} onClick={onRetryTagPrefixes}>
                      再試行
                    </Button>
                  )}
                </div>
              )}
            {groupValueItems.length === 0 ? (
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
              <GroupValueGrid
                groupByLabel={groupByLabel}
                rows={rows}
                tileSize={tileSize}
                fallbackIcon={fallbackIcon}
                resetKey={resetKey}
                onSelect={handleSelect}
              />
            ) : (
              <GroupValueRows
                groupByLabel={groupByLabel}
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
