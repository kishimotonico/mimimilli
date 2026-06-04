import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { WorkSummary, AxisId } from "../../../types";
import {
  searchWorksV2,
  getAxisFacets,
  listSmartFolders,
  createSmartFolder,
  evalSmartFolder,
} from "../../../features/library/api";
import { getWork } from "../../../entities/work/api";
import { useLibraryView } from "../model/useLibraryNavigation";
import AxisColumn from "./AxisColumn";
import ContentColumn from "./ContentColumn";
import PreviewPane from "./PreviewPane";

type PreviewMode = "work" | "axis-landing" | "smart-folder" | "empty";

const VIEW_AXES = new Set(["all", "recent", "added", "fav", "unplayed", "missing"]);
const FACET_AXES = new Set(["circle", "cv", "series", "cat", "year"]);

function isFacetAxis(a: AxisId): boolean { return FACET_AXES.has(a as string); }
function isSmartAxis(a: AxisId): boolean { return (a as string).startsWith("smart-"); }

// ── Query key factory ─────────────────────────────────────────
// query key を一箇所で管理し、invalidation と依存を一致させる。
const LIBRARY_KEYS = {
  works: (params: object) => ["works", params] as const,
  libraryTotal: () => ["works", "total"] as const,
  smartFolderWorks: (id: string) => ["smartFolderWorks", id] as const,
  facets: (axis: string) => ["axisFacets", axis] as const,
  smartFolders: () => ["smartFolders"] as const,
  workDetail: (id: string) => ["work", id] as const,
} as const;

export { LIBRARY_KEYS };

interface LibraryViewProps {
  searchQuery: string;
  playingWorkId?: string;
  playingTrackIndex?: number;
  onPlay: (work: WorkSummary, trackIndex: number) => void;
}

export default function LibraryView({ searchQuery, playingWorkId, playingTrackIndex, onPlay }: LibraryViewProps) {
  const nav = useLibraryView();
  const queryClient = useQueryClient();

  // ── Works（通常軸）─────────────────────────────────────────
  const worksParams = (() => {
    if (isSmartAxis(nav.activeAxis)) return null; // 別 query
    const p: Parameters<typeof searchWorksV2>[0] = { sort: nav.sort };
    if (searchQuery) p.q = searchQuery;
    if (nav.activeAxis === "tag" && nav.selectedTags.length > 0) {
      p.tags = nav.selectedTags;
      p.tagOp = "AND";
    }
    if (VIEW_AXES.has(nav.activeAxis as string) && nav.activeAxis !== "all") {
      p.view = nav.activeAxis as string;
    }
    if (isFacetAxis(nav.activeAxis) && nav.drillValue) {
      p.axis = nav.activeAxis as string;
      p.axisValue = nav.drillValue;
    }
    return p;
  })();

  const worksQuery = useQuery({
    queryKey: LIBRARY_KEYS.works(worksParams ?? {}),
    queryFn: () => searchWorksV2(worksParams!),
    enabled: worksParams !== null,
  });

  // ── Works（スマートフォルダー軸）──────────────────────────
  const smartAxisId = isSmartAxis(nav.activeAxis)
    ? (nav.activeAxis as string).slice("smart-".length)
    : null;

  const smartWorksQuery = useQuery({
    queryKey: LIBRARY_KEYS.smartFolderWorks(smartAxisId ?? ""),
    queryFn: () => evalSmartFolder(smartAxisId!),
    enabled: smartAxisId !== null,
  });

  const works = isSmartAxis(nav.activeAxis)
    ? (smartWorksQuery.data ?? [])
    : (worksQuery.data ?? []);
  const isLoading = isSmartAxis(nav.activeAxis)
    ? smartWorksQuery.isPending
    : worksQuery.isPending;
  const isError = isSmartAxis(nav.activeAxis)
    ? smartWorksQuery.isError
    : worksQuery.isError;

  // ── ライブラリ総件数 ──────────────────────────────────────
  const libraryTotalQuery = useQuery({
    queryKey: LIBRARY_KEYS.libraryTotal(),
    queryFn: () => searchWorksV2({}).then((w) => w.length),
  });

  // ── ファセット items ──────────────────────────────────────
  const facetAxis =
    (isFacetAxis(nav.activeAxis) && !nav.drillValue) || nav.activeAxis === "tag"
      ? (nav.activeAxis as string)
      : null;

  const facetQuery = useQuery({
    queryKey: LIBRARY_KEYS.facets(facetAxis ?? ""),
    queryFn: () => getAxisFacets(facetAxis!),
    enabled: facetAxis !== null,
  });

  // ── スマートフォルダー一覧 ────────────────────────────────
  const smartFoldersQuery = useQuery({
    queryKey: LIBRARY_KEYS.smartFolders(),
    queryFn: listSmartFolders,
  });
  const smartFolders = smartFoldersQuery.data ?? [];

  // ── スマートフォルダー作成 mutation ───────────────────────
  const createSmartFolderMutation = useMutation({
    mutationFn: createSmartFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.smartFolders() });
    },
  });

  // ── 選択中作品の詳細 ──────────────────────────────────────
  const workDetailQuery = useQuery({
    queryKey: LIBRARY_KEYS.workDetail(nav.selectedWorkId ?? ""),
    queryFn: () => getWork(nav.selectedWorkId!),
    enabled: nav.selectedWorkId !== null,
  });
  const selectedWork = workDetailQuery.data ?? null;

  // ── previewMode: UI state + server state を組み合わせてコンポーネントで計算 ──
  // (derived atom にしない — issue の制約参照)
  const previewMode: PreviewMode = nav.selectedWorkId && selectedWork
    ? "work"
    : isSmartAxis(nav.activeAxis)
    ? "smart-folder"
    : isFacetAxis(nav.activeAxis) && !nav.drillValue
    ? "axis-landing"
    : nav.activeAxis === "tag" && nav.selectedTags.length > 0
    ? "axis-landing"
    : "empty";

  const activeSmartFolder = isSmartAxis(nav.activeAxis)
    ? smartFolders.find((sf) => sf.id === (nav.activeAxis as string).slice("smart-".length)) ?? null
    : null;

  const handlePlay = useCallback((trackIndex: number) => {
    if (selectedWork) {
      const summary: Parameters<typeof onPlay>[0] = {
        id: selectedWork.id,
        title: selectedWork.title,
        coverImage: selectedWork.coverImage,
        status: selectedWork.status,
        physicalPath: selectedWork.physicalPath,
        totalDurationSec: selectedWork.totalDurationSec,
        addedAt: selectedWork.addedAt,
        errorMessage: selectedWork.errorMessage,
        urls: selectedWork.urls,
        tags: selectedWork.tags,
        trackCount: selectedWork.playlists[0]?.tracks.length ?? 0,
        bookmarked: selectedWork.bookmarked,
        lastPlayedAt: selectedWork.lastPlayedAt,
      };
      onPlay(summary, trackIndex);
    }
  }, [selectedWork, onPlay]);

  return (
    <>
      <AxisColumn
        activeAxis={nav.activeAxis}
        totalCount={libraryTotalQuery.data}
        smartFolders={smartFolders}
        onSelectAxis={nav.setAxis}
        onNewSmartFolder={() => {
          const name = window.prompt("スマートフォルダー名:");
          if (!name) return;
          createSmartFolderMutation.mutate({ name, rules: [], sort: "added-desc" });
        }}
      />

      <ContentColumn
        axis={nav.activeAxis}
        drillValue={nav.drillValue}
        works={works}
        facetItems={facetQuery.data ?? []}
        selectedWorkId={nav.selectedWorkId}
        selectedTags={nav.selectedTags}
        playingWorkId={playingWorkId}
        isLoading={isLoading}
        isError={isError}
        onWorkSelect={nav.selectWork}
        onDrillSelect={nav.drillInto}
        onDrillBack={nav.drillBack}
        onTagToggle={nav.toggleTag}
      />

      <PreviewPane
        mode={previewMode}
        axis={nav.activeAxis}
        selectedWork={selectedWork}
        smartFolder={activeSmartFolder}
        axisWorks={works}
        smartFolderWorks={works}
        playingTrackIndex={
          selectedWork && playingWorkId === selectedWork.id ? (playingTrackIndex ?? null) : null
        }
        onPlay={handlePlay}
      />
    </>
  );
}
