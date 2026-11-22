import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence } from "motion/react";
import type { NormalizedTag, SmartFolder, TagPrefix } from "@mimimilli/shared";
import { getAxisLabel } from "../../../entities/library/axisDefinitions";
import {
  useHoverGroupCoordinator,
  type HoverGroupTriggerHandlers,
} from "../../../shared/lib/useHoverGroupCoordinator";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import { formatDuration } from "../../../shared/lib/format";
import { axisOfGroupBy, type CollectionStatsDisplay } from "../model/libraryPresentation";
import { buildSidebarRows, type DataIntegrityCount, type SidebarRow } from "../model/sidebarRows";
import GroupQuickOverlay from "./GroupQuickOverlay";

interface SidebarRowItemProps {
  row: SidebarRow;
  isActive: boolean;
  isOverlayOpen: boolean;
  onSelect: () => void;
  getTriggerHandlers: (key: string) => HoverGroupTriggerHandlers;
  openImmediately: (key: string, el: HTMLElement | null) => void;
}

function SidebarRowItem({
  row,
  isActive,
  isOverlayOpen,
  onSelect,
  getTriggerHandlers,
  openImmediately,
}: SidebarRowItemProps) {
  const rowRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!row.hasQuickOverlay || isOverlayOpen) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      openImmediately(row.id, rowRef.current);
    }
  };

  const Icon = I[row.icon];
  return (
    <button
      ref={rowRef}
      type="button"
      className={`mll-sbrow ${isActive ? "is-on" : ""}`}
      aria-current={isActive ? "true" : undefined}
      aria-expanded={row.hasQuickOverlay ? isOverlayOpen : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      {...(row.hasQuickOverlay ? getTriggerHandlers(row.id) : undefined)}
    >
      <Icon size={15} />
      <span className="nm">{row.name}</span>
      {row.count !== null && (
        <span className={`ct ${row.countTone === "error" ? "is-error" : ""}`}>{row.count}</span>
      )}
      {row.hasQuickOverlay && <I.chev size={12} className="chev" />}
    </button>
  );
}

export type SidebarFolders =
  | { status: "ready"; folders: SmartFolder[] }
  | { status: "pending" }
  | { status: "error"; onRetry: () => void };

interface LibrarySidebarPanelProps {
  folders: SidebarFolders;
  /** 開いているスマートフォルダー。作品詳細でも元のスマートフォルダーを指す */
  activeFolderId: string | null;
  activeGroup: string | null;
  dataIntegrity: DataIntegrityCount;
  tagPrefixes: TagPrefix[];
  stats: CollectionStatsDisplay;
  onOpenFolder: (folderId: string) => void;
  /** クイックオーバーレイの値。主クリックも Ctrl+クリックもその値の作品一覧へ進む */
  onOpenGroupValue: (folderId: string, group: string) => void;
  /** クイックオーバーレイの追加ボタン */
  onAddTag: (tag: NormalizedTag) => void;
}

export default function LibrarySidebarPanel({
  folders,
  activeFolderId,
  activeGroup,
  dataIntegrity,
  tagPrefixes,
  stats,
  onOpenFolder,
  onOpenGroupValue,
  onAddTag,
}: LibrarySidebarPanelProps) {
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
  const readyFolders = folders.status === "ready" ? folders.folders : [];
  const rows = buildSidebarRows(readyFolders, activeFolderId ?? "", dataIntegrity);
  const overlayFolder = readyFolders.find((folder) => folder.id === overlayFolderId) ?? null;
  const overlayGroupBy = overlayFolder?.groupBy ?? null;

  return (
    <nav className="mll-sidebar" aria-label="ライブラリ">
      <div className="mll-sidebar__scroll">
        <div className="mll-sidebar__hd">ライブラリ</div>
        {rows.map((row) => (
          <SidebarRowItem
            key={row.id}
            row={row}
            isActive={activeFolderId === row.id}
            isOverlayOpen={overlayFolderId === row.id}
            onSelect={() => {
              closeOverlay();
              onOpenFolder(row.id);
            }}
            getTriggerHandlers={getTriggerHandlers}
            openImmediately={openImmediately}
          />
        ))}
        {folders.status === "error" && (
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <output> はフォーム計算結果向けの意味を持つため、読み込み失敗通知には role="status" を使う
          <div className="mll-sidebar__error" role="status" aria-live="polite">
            <span>一覧の取得に失敗しました</span>
            <Button variant="ghost" icon={I.refresh} onClick={folders.onRetry}>
              再試行
            </Button>
          </div>
        )}
      </div>

      {stats.status === "ready" && (
        <div className="mll-sidebar__foot">
          {stats.count}作品 · {stats.trackCount}トラック ·{" "}
          {formatDuration(stats.durationSec) ?? "0:00"}
        </div>
      )}
      {stats.status === "error" && (
        <div className="mll-sidebar__foot">統計の取得に失敗しました</div>
      )}

      <AnimatePresence>
        {overlayFolder && overlayGroupBy && ownerToken && (
          <GroupQuickOverlay
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
    </nav>
  );
}
