/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストは行を絶対配置するため table 要素にできず、ARIA table 構造（rowgroup/row/columnheader）を role で与える */
import { UNREGISTERED_GRID_CLASS } from "./layout";
import { cn } from "../../../../../shared/lib/cn";

const HEADING_CLASS = "font-sans text-label font-semibold text-ink-2";

export default function UnregisteredListHeader() {
  return (
    <div role="rowgroup" className="shrink-0">
      <div
        role="row"
        className={cn(UNREGISTERED_GRID_CLASS, "h-[30px] border-b border-line-soft bg-paper-0")}
      >
        <span role="columnheader">
          <span className="sr-only">選択</span>
        </span>
        <span role="columnheader" className={HEADING_CLASS}>
          カバー
        </span>
        <span role="columnheader" className={HEADING_CLASS}>
          タイトル
        </span>
        <span role="columnheader" className={HEADING_CLASS}>
          RJコード
        </span>
        <span role="columnheader" className={HEADING_CLASS}>
          DLsite
        </span>
      </div>
    </div>
  );
}
