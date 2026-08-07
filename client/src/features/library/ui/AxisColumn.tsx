import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { NormalizedTag, SmartFolder, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { buildFacetAxisRows, isFacetAxis } from "../model/axisDefinitions";
import {
  useHoverGroupCoordinator,
  type HoverGroupTriggerHandlers,
} from "../../../shared/lib/useHoverGroupCoordinator";
import AxisQuickOverlay from "./AxisQuickOverlay";
import { I, type IconName } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";

interface AxisRow {
  id: AxisId;
  name: string;
  icon: IconName;
  badge?: number;
  isAction?: boolean;
}

const HOME_AXIS: AxisRow = { id: "home", name: "ホーム", icon: "home" };

const VIEW_AXES: AxisRow[] = [
  { id: "all", name: "すべての作品", icon: "gridS" },
  { id: "recent", name: "最近再生", icon: "refresh" },
  { id: "added", name: "最近追加", icon: "add" },
  { id: "fav", name: "お気に入り", icon: "star" },
  { id: "unplayed", name: "未再生", icon: "audio" },
  { id: "missing", name: "ファイル欠損", icon: "err" },
];

interface AxisColumnProps {
  activeAxis: AxisId;
  tagPrefixes: TagPrefix[];
  smartFolders: SmartFolder[];
  totalCount?: number;
  selectedTags: NormalizedTag[];
  /** 分類軸の元になる GET /tag-prefixes の取得失敗。無言でCV/サークル等の行が
   *  消えるのを防ぎ、分類軸グループにエラー行を出す */
  isTagPrefixesError?: boolean;
  onSelectAxis: (axis: AxisId) => void;
  onToggleTag: (tag: NormalizedTag) => void;
  onReplaceTag: (tag: NormalizedTag) => void;
  onNewSmartFolder?: () => void;
  onRetryTagPrefixes?: () => void;
}

function AxisRowItem({
  ax,
  isActive,
  hasQuickOverlay,
  isOverlayOpen,
  onSelect,
  getTriggerHandlers,
  openImmediately,
}: {
  ax: AxisRow;
  isActive: boolean;
  hasQuickOverlay: boolean;
  isOverlayOpen: boolean;
  onSelect: () => void;
  getTriggerHandlers: (key: string) => HoverGroupTriggerHandlers;
  openImmediately: (key: string, el: HTMLElement | null) => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!hasQuickOverlay || isOverlayOpen) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      openImmediately(ax.id, rowRef.current);
    }
  };

  const Ic = I[ax.icon];
  return (
    <button
      ref={rowRef}
      type="button"
      className={`mll-axis ${isActive ? "is-on" : ""}`}
      aria-current={isActive ? "true" : undefined}
      aria-haspopup={hasQuickOverlay ? "listbox" : undefined}
      aria-expanded={hasQuickOverlay ? isOverlayOpen : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      {...(hasQuickOverlay ? getTriggerHandlers(ax.id) : undefined)}
    >
      <span className="ic">
        <Ic size={14} />
      </span>
      <span className="nm">{ax.name}</span>
      {ax.badge != null && <span className="badge">{ax.badge}</span>}
      {!ax.isAction && (
        <span className="chev">
          <I.chev size={11} />
        </span>
      )}
    </button>
  );
}

export default function AxisColumn({
  activeAxis,
  tagPrefixes,
  smartFolders,
  totalCount,
  selectedTags,
  isTagPrefixesError,
  onSelectAxis,
  onToggleTag,
  onReplaceTag,
  onNewSmartFolder,
  onRetryTagPrefixes,
}: AxisColumnProps) {
  const facetAxisRows = buildFacetAxisRows(tagPrefixes);
  const {
    openKey: overlayAxis,
    openAnchorEl,
    panelElRef,
    getTriggerHandlers,
    panelHandlers,
    openImmediately,
    close: closeOverlay,
  } = useHoverGroupCoordinator();

  // クイックオーバーレイの選択は既定=置き換え、Ctrl/Cmd+クリックで AND 追加へ反転する（ADR-0012 §7）。
  // 置き換えは結果面を作品一覧へ遷移させ、AND追加は現在の結果面に留まる（ADR-0012 §8）。
  const handleSelectValue = (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => {
    if (opts.ctrlKey || opts.metaKey) onToggleTag(tag);
    else onReplaceTag(tag);
  };

  const renderRow = (ax: AxisRow) => {
    const hasQuickOverlay = isFacetAxis(ax.id) || ax.id === "tag";
    return (
      <AxisRowItem
        key={ax.id}
        ax={ax}
        isActive={activeAxis === ax.id}
        hasQuickOverlay={hasQuickOverlay}
        isOverlayOpen={overlayAxis === ax.id}
        onSelect={() => {
          closeOverlay();
          onSelectAxis(ax.id);
        }}
        getTriggerHandlers={getTriggerHandlers}
        openImmediately={openImmediately}
      />
    );
  };

  return (
    <div className="mle-col is-axis">
      <div className="mle-col__hd">
        <span>ライブラリ</span>
        {totalCount != null && <span className="count">{totalCount} 件</span>}
      </div>
      <div className="mle-col__list">
        <div className="mll-axisgroup">{renderRow(HOME_AXIS)}</div>

        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">ビュー</div>
          {VIEW_AXES.map(renderRow)}
        </div>

        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">分類軸</div>
          {isTagPrefixesError && (
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <output> はフォーム計算結果向けの意味を持つため、分類軸の読み込み失敗通知には role="status" を使う
            <div className="mll-axis-error" role="status" aria-live="polite">
              <span>分類軸の取得に失敗しました</span>
              {onRetryTagPrefixes && (
                <Button variant="ghost" icon={I.refresh} onClick={onRetryTagPrefixes}>
                  再試行
                </Button>
              )}
            </div>
          )}
          {facetAxisRows.map(renderRow)}
        </div>

        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">スマートフォルダー</div>
          {smartFolders.map((sf) =>
            renderRow({ id: `smart-${sf.id}` as AxisId, name: sf.name, icon: "gridS" }),
          )}
          <button type="button" className="mll-axis is-action" onClick={onNewSmartFolder}>
            <span className="ic">
              <I.add size={14} />
            </span>
            <span className="nm">+ 新規スマートフォルダー</span>
          </button>
        </div>
      </div>

      {overlayAxis && (
        <AxisQuickOverlay
          axis={overlayAxis}
          anchorEl={openAnchorEl}
          isOpen
          selectedTags={selectedTags}
          onSelectValue={handleSelectValue}
          onClose={closeOverlay}
          panelHandlers={panelHandlers}
          panelElRef={panelElRef}
        />
      )}
    </div>
  );
}
