import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { SmartFolder, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import { buildFacetAxisRows, isFacetAxis } from "../model/axisDefinitions";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { useHoverIntent, type HoverIntentHandlers } from "../../../shared/lib/useHoverIntent";
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
  /** 分類軸の元になる GET /tag-prefixes の取得失敗。無言でCV/サークル等の行が
   *  消えるのを防ぎ、分類軸グループにエラー行を出す */
  isTagPrefixesError?: boolean;
  onSelectAxis: (axis: AxisId) => void;
  onNewSmartFolder?: () => void;
  onRetryTagPrefixes?: () => void;
}

/** 開いている（または開こうとしている）クイックオーバーレイの状態。
 *  panelHandlers はトリガー行を開いた useHoverIntent インスタンスのものをそのまま
 *  オーバーレイパネル側へ渡す。同じタイマーを共有するため、行↔パネル間の移動で
 *  閉じない（ADR-0012 §7・AC#2）。 */
interface QuickOverlayState {
  axis: AxisId;
  anchorEl: HTMLElement;
  panelHandlers: HoverIntentHandlers;
}

function AxisRowItem({
  ax,
  isActive,
  hasQuickOverlay,
  isOverlayOpen,
  onSelect,
  onRequestOverlayOpen,
  onRequestOverlayClose,
}: {
  ax: AxisRow;
  isActive: boolean;
  hasQuickOverlay: boolean;
  isOverlayOpen: boolean;
  onSelect: () => void;
  onRequestOverlayOpen: (
    axis: AxisId,
    el: HTMLElement | null,
    panelHandlers: HoverIntentHandlers,
  ) => void;
  onRequestOverlayClose: () => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const { trigger, panel } = useHoverIntent({
    onOpen: () => onRequestOverlayOpen(ax.id, rowRef.current, panel),
    onClose: onRequestOverlayClose,
  });

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!hasQuickOverlay || isOverlayOpen) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onRequestOverlayOpen(ax.id, rowRef.current, panel);
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
      {...(hasQuickOverlay ? trigger : undefined)}
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
  isTagPrefixesError,
  onSelectAxis,
  onNewSmartFolder,
  onRetryTagPrefixes,
}: AxisColumnProps) {
  const facetAxisRows = buildFacetAxisRows(tagPrefixes);
  const nav = useLibraryNavigation();
  const [overlay, setOverlay] = useState<QuickOverlayState | null>(null);

  const requestOverlayOpen = (
    axis: AxisId,
    el: HTMLElement | null,
    panelHandlers: HoverIntentHandlers,
  ) => {
    if (!el) return;
    setOverlay({ axis, anchorEl: el, panelHandlers });
  };
  const requestOverlayClose = () => setOverlay(null);

  // クイックオーバーレイの選択は既定=置き換え、Ctrl/Cmd+クリックで AND 追加へ反転する（ADR-0012 §7）。
  // 置き換えは結果面を作品一覧へ遷移させ、AND追加は現在の結果面に留まる（ADR-0012 §8）。
  const handleSelectValue = (tag: string, opts: { ctrlKey: boolean; metaKey: boolean }) => {
    if (opts.ctrlKey || opts.metaKey) nav.toggleTag(tag);
    else nav.replaceTagAndShowWorks(tag);
  };

  const renderRow = (ax: AxisRow) => {
    const hasQuickOverlay = isFacetAxis(ax.id) || ax.id === "tag";
    return (
      <AxisRowItem
        key={ax.id}
        ax={ax}
        isActive={activeAxis === ax.id}
        hasQuickOverlay={hasQuickOverlay}
        isOverlayOpen={overlay?.axis === ax.id}
        onSelect={() => {
          requestOverlayClose();
          onSelectAxis(ax.id);
        }}
        onRequestOverlayOpen={requestOverlayOpen}
        onRequestOverlayClose={requestOverlayClose}
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

      {overlay && (
        <AxisQuickOverlay
          axis={overlay.axis}
          anchorEl={overlay.anchorEl}
          isOpen
          selectedTags={nav.selectedTags}
          onSelectValue={handleSelectValue}
          onClose={requestOverlayClose}
          panelHandlers={overlay.panelHandlers}
        />
      )}
    </div>
  );
}
