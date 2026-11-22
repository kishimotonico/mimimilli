import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence } from "motion/react";
import {
  showsCount,
  type NormalizedTag,
  type SmartFolderItem,
  type TagPrefix,
} from "@mimimilli/shared";
import { getAxisLabel, getSmartFolderIcon } from "../../../entities/library/axisDefinitions";
import {
  useHoverGroupCoordinator,
  type HoverGroupTriggerHandlers,
} from "../../../shared/lib/useHoverGroupCoordinator";
import AxisQuickOverlay from "./AxisQuickOverlay";
import { I, type IconName } from "../../../shared/ui/Icon";
import { formatDuration } from "../../../shared/lib/format";
import { axisOfGroupBy, type CollectionStatsDisplay } from "../model/libraryPresentation";

interface AxisRow {
  id: string;
  name: string;
  icon: IconName;
  badge?: number;
  hasQuickOverlay: boolean;
}

interface AxisColumnProps {
  folders: SmartFolderItem[];
  /** 開いているスマートフォルダー（解決済み）とグループの値 */
  activeFolderId: string;
  activeGroup: string | null;
  tagPrefixes: TagPrefix[];
  /** ライブラリ全体の統計。軸レール下部に常時表示する */
  stats: CollectionStatsDisplay;
  onOpenFolder: (folderId: string) => void;
  /** クイックオーバーレイの値。主クリックも Ctrl+クリックもその値の作品一覧へ進む */
  onOpenGroupValue: (folderId: string, group: string) => void;
  /** クイックオーバーレイの追加ボタン */
  onAddTag: (tag: NormalizedTag) => void;
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
      <span className="chev">
        <I.chev size={11} />
      </span>
    </button>
  );
}

function toRow(folder: SmartFolderItem): AxisRow {
  const { condition } = folder;
  if (condition === null) {
    return { id: folder.id, name: folder.name, icon: "err", hasQuickOverlay: false };
  }
  return {
    id: folder.id,
    name: folder.name,
    icon: getSmartFolderIcon(folder.id),
    badge: showsCount({ condition, groupBy: folder.groupBy })
      ? (folder.count ?? undefined)
      : undefined,
    hasQuickOverlay: folder.groupBy !== null,
  };
}

export default function AxisColumn({
  folders,
  activeFolderId,
  activeGroup,
  tagPrefixes,
  stats,
  onOpenFolder,
  onOpenGroupValue,
  onAddTag,
}: AxisColumnProps) {
  const {
    openKey: overlayFolderId,
    openAnchorEl,
    ownerToken,
    registerPanelEl,
    getTriggerHandlers,
    getPanelHandlers,
    openImmediately,
    close: closeOverlay,
  } = useHoverGroupCoordinator();
  const overlayFolder = folders.find((folder) => folder.id === overlayFolderId) ?? null;
  const overlayGroupBy = overlayFolder?.groupBy ?? null;

  return (
    <div className="mle-col is-axis">
      <div className="mle-col__list">
        <div className="mll-axisgroup">
          <div className="mll-axisgroup__hd">ライブラリ</div>
          {folders.map((folder) => {
            const row = toRow(folder);
            return (
              <AxisRowItem
                key={row.id}
                ax={row}
                isActive={activeFolderId === row.id}
                hasQuickOverlay={row.hasQuickOverlay}
                isOverlayOpen={overlayFolderId === row.id}
                onSelect={() => {
                  closeOverlay();
                  onOpenFolder(row.id);
                }}
                getTriggerHandlers={getTriggerHandlers}
                openImmediately={openImmediately}
              />
            );
          })}
        </div>
      </div>

      {stats.status === "ready" && (
        <div className="mll-axisfoot">
          {stats.count}作品 · {stats.trackCount}トラック ·{" "}
          {formatDuration(stats.durationSec) ?? "0:00"}
        </div>
      )}
      {stats.status === "error" && <div className="mll-axisfoot">統計の取得に失敗しました</div>}

      <AnimatePresence>
        {overlayFolder && overlayGroupBy && ownerToken && (
          <AxisQuickOverlay
            key={overlayFolder.id}
            folderId={overlayFolder.id}
            axis={axisOfGroupBy(overlayGroupBy)}
            axisLabel={getAxisLabel(axisOfGroupBy(overlayGroupBy), tagPrefixes)}
            anchorEl={openAnchorEl}
            selectedValue={overlayFolder.id === activeFolderId ? activeGroup : null}
            onSelectValue={(value) => onOpenGroupValue(overlayFolder.id, value)}
            onAddTag={onAddTag}
            onClose={closeOverlay}
            panelHandlers={getPanelHandlers(ownerToken)}
            onPanelElChange={(el) => registerPanelEl(ownerToken, el)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
