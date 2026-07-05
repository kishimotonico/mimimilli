import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Work, WorkPatch, WorkSummary } from "@mimimilli/shared";
import type { AxisId } from "../model/types";
import {
  searchWorks,
  getAxisFacets,
  listSmartFolders,
  createSmartFolder,
  evalSmartFolder,
} from "../../../features/library/api";
import { getAllTags, getWork, patchWork } from "../../../entities/work/api";
import { useLibraryView } from "../model/useLibraryNavigation";
import { getAxisLandingPresentation } from "../model/axisLandingPresentation";
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
  allWorks: () => ["works"] as const,
  works: (params: object) => ["works", params] as const,
  libraryTotal: () => ["works", "total"] as const,
  allSmartFolderWorks: () => ["smartFolderWorks"] as const,
  smartFolderWorks: (id: string) => ["smartFolderWorks", id] as const,
  allFacets: () => ["axisFacets"] as const,
  facets: (axis: string) => ["axisFacets", axis] as const,
  smartFolders: () => ["smartFolders"] as const,
  workDetail: (id: string) => ["work", id] as const,
  tags: () => ["tags"] as const,
} as const;

export { LIBRARY_KEYS };

interface LibraryViewProps {
  searchQuery: string;
  playingWorkId?: string;
  playingTrackIndex?: number;
  isPlaybackActive?: boolean;
  onPlay: (work: WorkSummary, trackIndex: number) => void;
  onResume: (work: Work) => void;
}

export default function LibraryView({ searchQuery, playingWorkId, playingTrackIndex, isPlaybackActive, onPlay, onResume }: LibraryViewProps) {
  const nav = useLibraryView();
  const queryClient = useQueryClient();

  // ── Works（通常軸）─────────────────────────────────────────
  const worksParams = (() => {
    if (isSmartAxis(nav.activeAxis)) return null; // 別 query
    const p: Parameters<typeof searchWorks>[0] = { sort: nav.sort };
    if (searchQuery) p.q = searchQuery;
    if (nav.activeAxis === "tag" && nav.selectedTags.length > 0) {
      p.tags = nav.selectedTags;
      p.tagOp = "AND";
    }
    if (VIEW_AXES.has(nav.activeAxis as string) && nav.activeAxis !== "all") {
      p.view = nav.activeAxis as Parameters<typeof searchWorks>[0]["view"];
    }
    if (isFacetAxis(nav.activeAxis) && nav.drillValue) {
      p.axis = nav.activeAxis as Parameters<typeof searchWorks>[0]["axis"];
      p.axisValue = nav.drillValue;
    }
    return p;
  })();

  const worksQuery = useQuery({
    queryKey: LIBRARY_KEYS.works(worksParams ?? {}),
    queryFn: () => searchWorks(worksParams!),
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
    : (worksQuery.data?.items ?? []);
  const isLoading = isSmartAxis(nav.activeAxis)
    ? smartWorksQuery.isPending
    : worksQuery.isPending;
  const isError = isSmartAxis(nav.activeAxis)
    ? smartWorksQuery.isError
    : worksQuery.isError;

  // ── ライブラリ総件数 ──────────────────────────────────────
  const libraryTotalQuery = useQuery({
    queryKey: LIBRARY_KEYS.libraryTotal(),
    queryFn: () => searchWorks({ limit: 1 }).then((page) => page.total),
  });

  // ── ファセット items ──────────────────────────────────────
  const facetAxis =
    (isFacetAxis(nav.activeAxis) && !nav.drillValue) || nav.activeAxis === "tag"
      ? (nav.activeAxis as Parameters<typeof getAxisFacets>[0])
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

  const tagsQuery = useQuery({
    queryKey: LIBRARY_KEYS.tags(),
    queryFn: getAllTags,
  });

  const patchWorkMutation = useMutation({
    mutationFn: ({ workId, body }: { workId: string; body: WorkPatch }) =>
      patchWork(workId, body),
    onSuccess: async (updatedWork, { workId }) => {
      queryClient.setQueryData(LIBRARY_KEYS.workDetail(workId), updatedWork);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.allWorks() }),
        queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.libraryTotal() }),
        queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.allFacets() }),
        queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.allSmartFolderWorks() }),
        queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.workDetail(workId) }),
        queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.tags() }),
      ]);
    },
    onError: (error, { workId, body }) => {
      console.error("作品メタデータの更新に失敗しました", { workId, body, error });
    },
  });

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
  const isAxisFilterApplied = nav.activeAxis === "tag" && nav.selectedTags.length > 0;

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

  const handleResume = useCallback(() => {
    if (selectedWork) onResume(selectedWork);
  }, [selectedWork, onResume]);

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
        isPlaybackActive={isPlaybackActive}
        isLoading={isLoading}
        isError={isError}
        onWorkSelect={nav.selectWork}
        onDrillSelect={nav.drillInto}
        onDrillBack={nav.drillBack}
        onTagToggle={nav.toggleTag}
      />

      <PreviewPane
        mode={previewMode}
        axisLandingPresentation={getAxisLandingPresentation(nav.activeAxis, isAxisFilterApplied)}
        selectedWork={selectedWork}
        smartFolder={activeSmartFolder}
        axisWorks={works}
        smartFolderWorks={works}
        playingTrackIndex={
          selectedWork && playingWorkId === selectedWork.id ? (playingTrackIndex ?? null) : null
        }
        onPlay={handlePlay}
        onResume={handleResume}
        onSelectWork={nav.selectWork}
        tagSuggestions={tagsQuery.data ?? []}
        isPatching={patchWorkMutation.isPending}
        onPatchWork={(body) => {
          if (!selectedWork) {
            return Promise.reject(new Error("更新対象の作品が選択されていません"));
          }
          return patchWorkMutation.mutateAsync({ workId: selectedWork.id, body });
        }}
      />
    </>
  );
}
