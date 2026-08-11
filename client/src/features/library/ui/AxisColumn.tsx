import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence } from "motion/react";
import type { NormalizedTag, SmartFolder, TagPrefix } from "@mimimilli/shared";
import type { AxisId } from "../../../entities/library/types";
import {
  buildFacetAxisRows,
  buildViewAxisRows,
  getAxisLabel,
  isFacetAxis,
} from "../../../entities/library/axisDefinitions";
import {
  useHoverGroupCoordinator,
  type HoverGroupTriggerHandlers,
} from "../../../shared/lib/useHoverGroupCoordinator";
import AxisQuickOverlay from "./AxisQuickOverlay";
import { I, type IconName } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import {
  deriveValueSelectionHandlers,
  type ValueSelectionIntent,
} from "../model/valueSelectionContract";

interface AxisRow {
  id: AxisId;
  name: string;
  icon: IconName;
  badge?: number;
  isAction?: boolean;
}

const HOME_AXIS: AxisRow = { id: "home", name: "ホーム", icon: "home" };

interface AxisColumnProps {
  activeAxis: AxisId;
  tagPrefixes: TagPrefix[];
  smartFolders: SmartFolder[];
  selectedTags: NormalizedTag[];
  /** 分類軸の元になる GET /tag-prefixes の取得失敗。無言でCV/サークル等の行が
   *  消えるのを防ぎ、分類軸グループにエラー行を出す */
  isTagPrefixesError?: boolean;
  onSelectAxis: (axis: AxisId) => void;
  onToggleTag: (tag: NormalizedTag) => void;
  onReplaceTag: (tag: NormalizedTag) => void;
  /** 追加ボタン用の冪等なAND追加（ADR-0013） */
  onAddTag: (tag: NormalizedTag) => void;
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
  selectedTags,
  isTagPrefixesError,
  onSelectAxis,
  onToggleTag,
  onReplaceTag,
  onAddTag,
  onNewSmartFolder,
  onRetryTagPrefixes,
}: AxisColumnProps) {
  const viewAxisRows = buildViewAxisRows();
  const facetAxisRows = buildFacetAxisRows(tagPrefixes);
  const {
    openKey: overlayAxis,
    openAnchorEl,
    ownerToken,
    registerPanelEl,
    getTriggerHandlers,
    getPanelHandlers,
    openImmediately,
    close: closeOverlay,
  } = useHoverGroupCoordinator();

  // クイックオーバーレイは既定=置き換えの入口（値選択の契約。design-system.md）。
  // 置き換えは結果面を作品一覧へ遷移させ、AND追加は現在の結果面に留まる（ADR-0012 §8）。
  const valueSelectionIntent: ValueSelectionIntent<NormalizedTag> = {
    default: "replace",
    onReplace: onReplaceTag,
    onToggle: onToggleTag,
    onAdd: onAddTag,
  };
  const { onSelect: handleSelectValue, onAddButton: handleAddValue } =
    deriveValueSelectionHandlers(valueSelectionIntent);

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
      <div className="mle-col__list">
        <div className="mll-axisgroup">{renderRow(HOME_AXIS)}</div>

        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">ビュー</div>
          {viewAxisRows.map(renderRow)}
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

      <AnimatePresence>
        {overlayAxis && ownerToken && (
          <AxisQuickOverlay
            key={overlayAxis}
            axis={overlayAxis}
            axisLabel={getAxisLabel(overlayAxis, tagPrefixes)}
            anchorEl={openAnchorEl}
            selectedTags={selectedTags}
            onSelectValue={handleSelectValue}
            onAddValue={handleAddValue}
            onClose={closeOverlay}
            panelHandlers={getPanelHandlers(ownerToken)}
            onPanelElChange={(el) => registerPanelEl(ownerToken, el)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
