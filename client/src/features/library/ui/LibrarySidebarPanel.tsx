import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence } from "motion/react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractInstruction } from "@atlaskit/pragmatic-drag-and-drop-hitbox/list-item";
import {
  ALL_SMART_FOLDER_ID,
  type Condition,
  type NormalizedTag,
  type SmartFolder,
  type TagPrefix,
} from "@mimimilli/shared";
import { getAxisLabel } from "../../../entities/library/axisDefinitions";
import {
  useHoverGroupCoordinator,
  type HoverGroupTriggerHandlers,
} from "../../../shared/lib/useHoverGroupCoordinator";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { MOBILE_MEDIA_QUERY, useMediaQuery } from "../../../shared/ui/useMediaQuery";
import { usePopoverDismissal } from "../../../shared/ui/usePopoverDismissal";
import { formatDuration } from "../../../shared/lib/format";
import { axisOfGroupBy, type CollectionStatsDisplay } from "../model/libraryPresentation";
import { buildSidebarRows, type DataIntegrityCount, type SidebarRow } from "../model/sidebarRows";
import { missingTemplates, reorderIds, smartFolderPermissions } from "../model/smartFolderEditing";
import { useSmartFolderEditor } from "../model/useSmartFolderEditor";
import GroupQuickOverlay from "./GroupQuickOverlay";
import SidebarAddMenu from "./SidebarAddMenu";
import SidebarEditRow, { SMART_FOLDER_DRAG_TYPE } from "./SidebarEditRow";
import SmartFolderDialog, { type SmartFolderDialogTarget } from "./SmartFolderDialog";

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
  /** 値・チップ・検索語のどれかで絞り込んでいるか。絞り込みが無いときだけ「複製」を出す */
  filtered?: boolean;
  onOpenFolder: (folderId: string) => void;
  /** 開いているスマートフォルダーを消したとき、「すべて」へ置き換えで移る */
  onReplaceFolder: (folderId: string) => void;
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
  filtered = false,
  onOpenFolder,
  onReplaceFolder,
  onOpenGroupValue,
  onAddTag,
}: LibrarySidebarPanelProps) {
  const editor = useSmartFolderEditor();
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<SmartFolderDialogTarget | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
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
  const rows = buildSidebarRows(readyFolders, activeFolderId ?? "", dataIntegrity, editing);
  const overlayFolder = readyFolders.find((folder) => folder.id === overlayFolderId) ?? null;
  const overlayGroupBy = overlayFolder?.groupBy ?? null;

  usePopoverDismissal({
    isOpen: menuOpen,
    onClose: () => setMenuOpen(false),
    anchorRef: headerRef,
  });

  const orderedIds = readyFolders.map((folder) => folder.id);
  const orderedIdsRef = useRef(orderedIds);
  orderedIdsRef.current = orderedIds;
  const reorderRef = useRef(editor.reorder);
  reorderRef.current = editor.reorder;
  const closeOverlayRef = useRef(closeOverlay);
  closeOverlayRef.current = closeOverlay;

  useEffect(() => {
    if (!editing) return;
    return monitorForElements({
      canMonitor: ({ source }) => source.data.type === SMART_FOLDER_DRAG_TYPE,
      onDragStart: () => closeOverlayRef.current(),
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets[0];
        if (!target) return;
        const operation = extractInstruction(target.data)?.operation;
        if (operation !== "reorder-before" && operation !== "reorder-after") return;
        const next = reorderIds(
          orderedIdsRef.current,
          String(source.data.id),
          String(target.data.id),
          operation,
        );
        if (next) void reorderRef.current(next);
      },
    });
  }, [editing]);

  const activeFolder = readyFolders.find((folder) => folder.id === activeFolderId) ?? null;
  const duplicateSource =
    activeFolder && activeFolder.condition !== null && !filtered
      ? (activeFolder as SmartFolder & { condition: Condition })
      : null;
  const allSort = readyFolders.find((folder) => folder.id === ALL_SMART_FOLDER_ID)?.sort ?? null;

  const startEditing = () => {
    closeOverlay();
    setMenuOpen(false);
    setEditing(true);
  };

  const saveDialog = async (data: Parameters<typeof editor.create>[0]) => {
    if (!dialog) return false;
    if (dialog.kind === "edit") {
      const saved = await editor.update(dialog.folder.id, data);
      if (saved) setDialog(null);
      return saved;
    }
    const created = await editor.create(data);
    if (!created) return false;
    setDialog(null);
    onOpenFolder(created.id);
    return true;
  };

  const addFromTemplate = async (templateId: string) => {
    setMenuOpen(false);
    const created = await editor.addFromTemplate(templateId);
    if (created) onOpenFolder(created.id);
  };

  return (
    <nav className="mll-sidebar" aria-label="ライブラリ">
      <div className="mll-sidebar__scroll">
        <div className="mll-sidebar__hd" ref={headerRef}>
          <span>ライブラリ</span>
          {editing ? (
            <button type="button" className="mll-sidebar__done" onClick={() => setEditing(false)}>
              完了
            </button>
          ) : (
            folders.status === "ready" && (
              <>
                <IconButton
                  icon={I.add}
                  label="追加"
                  size="xs"
                  tone="muted"
                  active={menuOpen}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                />
                <IconButton
                  icon={I.edit}
                  label="編集"
                  size="xs"
                  tone="muted"
                  onClick={startEditing}
                />
              </>
            )
          )}
          {menuOpen && (
            <SidebarAddMenu
              duplicateName={duplicateSource?.name ?? null}
              templates={missingTemplates(readyFolders)}
              onDuplicate={() => {
                setMenuOpen(false);
                if (duplicateSource) setDialog({ kind: "duplicate", folder: duplicateSource });
              }}
              onAddGroup={() => {
                setMenuOpen(false);
                setDialog({ kind: "group" });
              }}
              onAddTemplate={(templateId) => void addFromTemplate(templateId)}
            />
          )}
        </div>
        {rows.map((row) => {
          if (!editing) {
            return (
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
            );
          }
          const folder = readyFolders.find((item) => item.id === row.id)!;
          const permissions = smartFolderPermissions(folder);
          return (
            <SidebarEditRow
              key={row.id}
              row={row}
              canEdit={permissions.edit}
              canRemove={permissions.remove}
              draggableEnabled={!isMobile}
              onEdit={() => {
                if (folder.condition !== null) {
                  setDialog({
                    kind: "edit",
                    folder: folder as SmartFolder & { condition: Condition },
                  });
                }
              }}
              onRemove={() =>
                void editor.remove(folder, () => {
                  if (folder.id === activeFolderId) onReplaceFolder(ALL_SMART_FOLDER_ID);
                })
              }
            />
          );
        })}
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

      {dialog && allSort !== null && (
        <SmartFolderDialog
          key={dialog.kind === "group" ? "group" : `${dialog.kind}:${dialog.folder.id}`}
          target={dialog}
          allSort={allSort}
          tagPrefixes={tagPrefixes}
          onSave={saveDialog}
          onClose={() => setDialog(null)}
        />
      )}

      <AnimatePresence>
        {!editing && overlayFolder && overlayGroupBy && ownerToken && (
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
