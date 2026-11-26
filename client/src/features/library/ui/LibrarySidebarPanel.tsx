import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { AnimatePresence } from "motion/react";
import {
  ALL_SMART_FOLDER_ID,
  type NormalizedTag,
  type SmartFolder,
  type TagPrefix,
} from "@mimimilli/shared";
import { folderGrouping } from "../../../entities/library/resolveLibraryView";
import { getGroupByLabel } from "../../../entities/library/smartFolderDefinitions";
import { smartFolderCountsQueryOptions } from "../../../entities/smart-folder/queryOptions";
import { useHoverGroupCoordinator } from "../../../shared/lib/useHoverGroupCoordinator";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { MOBILE_MEDIA_QUERY, useMediaQuery } from "../../../shared/ui/useMediaQuery";
import { formatDuration } from "../../../shared/lib/format";
import { smartFolderDialogAtom } from "../model/atoms";
import { buildFilterTag, type CollectionStatsDisplay } from "../model/libraryPresentation";
import { buildSidebarRows } from "../model/sidebarRows";
import { missingTemplates } from "../model/smartFolderEditing";
import { useSidebarReorder } from "./useSidebarReorder";
import { useSmartFolderEditor } from "../model/useSmartFolderEditor";
import GroupValuePopover from "./GroupValuePopover";
import SidebarAddMenu from "./SidebarAddMenu";
import SidebarEditRow from "./SidebarEditRow";
import SidebarRowItem from "./SidebarRowItem";

export type SidebarFolders =
  | { status: "ready"; folders: SmartFolder[] }
  | { status: "pending" }
  | { status: "error"; onRetry: () => void };

interface LibrarySidebarPanelProps {
  folders: SidebarFolders;
  /** 開いているスマートフォルダー。作品詳細でも元のスマートフォルダーを指す */
  activeFolderId: string | null;
  activeGroup: string | null;
  tagPrefixes: TagPrefix[];
  stats: CollectionStatsDisplay;
  /** 値・チップ・検索語のどれかで絞り込んでいるか。絞り込みがあれば「今の検索を保存」、無ければ「複製」を出す */
  filtered: boolean;
  /** 「今の検索を保存」。保存のダイアログを開く */
  onSaveSearch: () => void;
  onOpenFolder: (folderId: string) => void;
  /** クイックオーバーレイの値。主クリックも Ctrl+クリックもその値の作品一覧へ進む */
  onOpenGroupValue: (folderId: string, group: string) => void;
  /** クイックオーバーレイの追加ボタン */
  onAddTag: (tag: NormalizedTag) => void;
}

/** props は開いているライブラリの状態とその操作（LibrarySidebar が view・route から渡す）。
 *  サイドバー自身の編集（並べ替え・追加・編集・削除・ダイアログ）と表示だけの状態はここで持つ */
export default function LibrarySidebarPanel({
  folders,
  activeFolderId,
  activeGroup,
  tagPrefixes,
  stats,
  filtered,
  onSaveSearch,
  onOpenFolder,
  onOpenGroupValue,
  onAddTag,
}: LibrarySidebarPanelProps) {
  const editor = useSmartFolderEditor();
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [editing, setEditing] = useState(false);
  const setDialog = useSetAtom(smartFolderDialogAtom);
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
  const { data: counts } = useQuery(smartFolderCountsQueryOptions);
  const rows = buildSidebarRows(readyFolders, counts);
  const overlayFolder = readyFolders.find((folder) => folder.id === overlayFolderId) ?? null;
  const overlayGrouping = overlayFolder ? folderGrouping(overlayFolder) : null;

  const { saving: reordering } = useSidebarReorder({
    enabled: editing,
    orderedIds: readyFolders.map((folder) => folder.id),
    reorder: editor.reorder,
    onDragStart: closeOverlay,
  });

  const activeFolder = readyFolders.find((folder) => folder.id === activeFolderId) ?? null;
  const duplicateSource = activeFolder && !filtered ? activeFolder : null;

  const startEditing = () => {
    closeOverlay();
    setEditing(true);
  };

  return (
    <nav className="mll-sidebar" aria-label="ライブラリ">
      <div className="mll-sidebar__scroll">
        <div className="mll-sidebar__hd">
          <span>ライブラリ</span>
          {editing ? (
            <button type="button" className="mll-sidebar__done" onClick={() => setEditing(false)}>
              完了
            </button>
          ) : (
            folders.status === "ready" && (
              <>
                <SidebarAddMenu
                  duplicateName={duplicateSource?.name ?? null}
                  canSaveSearch={filtered}
                  templates={missingTemplates(readyFolders)}
                  onDuplicate={() => {
                    if (duplicateSource) setDialog({ kind: "duplicate", folder: duplicateSource });
                  }}
                  onSaveSearch={onSaveSearch}
                  onAddGroup={() => setDialog({ kind: "group" })}
                  onAddTemplate={(templateId) => void editor.addFromTemplate(templateId)}
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
          return (
            <SidebarEditRow
              key={row.id}
              row={row}
              canRemove={folder.id !== ALL_SMART_FOLDER_ID}
              draggableEnabled={!isMobile}
              dragLocked={reordering}
              onEdit={() => {
                setDialog({ kind: "edit", folder });
              }}
              onRemove={() => void editor.remove(folder)}
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

      <AnimatePresence>
        {!editing && overlayFolder && overlayGrouping && ownerToken && (
          <GroupValuePopover
            key={overlayFolder.id}
            placement="right"
            // そこから入るとチップと検索語は消えるので、絞り込み無しで数える
            scope={{ folderId: overlayFolder.id }}
            groupBy={overlayGrouping.groupBy}
            groupSort={overlayGrouping.groupSort}
            groupByLabel={getGroupByLabel(overlayGrouping.groupBy, tagPrefixes)}
            anchorEl={openAnchorEl}
            selectedValue={overlayFolder.id === activeFolderId ? activeGroup : null}
            onSelectValue={(value) => onOpenGroupValue(overlayFolder.id, value)}
            onAddValue={(value) => onAddTag(buildFilterTag(overlayGrouping.groupBy, value))}
            onClose={closeOverlay}
            panelHandlers={getPanelHandlers(ownerToken)}
            onPanelElChange={(el) => registerPanelEl(ownerToken, el)}
          />
        )}
      </AnimatePresence>
    </nav>
  );
}
