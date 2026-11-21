/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストは行を絶対配置するため table 要素にできず、ARIA table 構造（rowgroup/row/columnheader）を role で与える */
import { useEffect, useRef } from "react";
import { UNREGISTERED_GRID_CLASS } from "./layout";
import { cn } from "../../../../../shared/lib/cn";
import { LIST_HEADING_ROW_CLASS } from "../listHeading";

interface UnregisteredListHeaderProps {
  allSelected: boolean;
  partiallySelected: boolean;
  selectAllDisabled: boolean;
  onToggleAll: () => void;
}

export default function UnregisteredListHeader({
  allSelected,
  partiallySelected,
  selectAllDisabled,
  onToggleAll,
}: UnregisteredListHeaderProps) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) checkboxRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  return (
    <div role="rowgroup" className="shrink-0">
      <div role="row" className={cn(UNREGISTERED_GRID_CLASS, LIST_HEADING_ROW_CLASS)}>
        <span role="columnheader" className="flex items-center">
          <input
            ref={checkboxRef}
            type="checkbox"
            aria-label="すべて選択"
            className="size-3.5"
            checked={allSelected}
            disabled={selectAllDisabled}
            onChange={onToggleAll}
          />
        </span>
        <span role="columnheader">カバー</span>
        <span role="columnheader">タイトル</span>
        <span role="columnheader">RJコード</span>
        <span role="columnheader">DLsite</span>
        <span role="columnheader">
          <span className="sr-only">操作</span>
        </span>
      </div>
    </div>
  );
}
