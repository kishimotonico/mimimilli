import { useEffect, useState, useCallback } from "react";
import type { WorkSummary, Work, AxisFacetItem, SmartFolder, AxisId } from "../../../types";
import * as api from "../../../api";
import { useLibraryView } from "../model/useLibraryNavigation";
import AxisColumn from "./AxisColumn";
import ContentColumn from "./ContentColumn";
import PreviewPane from "./PreviewPane";

type PreviewMode = "work" | "axis-landing" | "smart-folder" | "empty";

const VIEW_AXES = new Set(["all", "recent", "added", "fav", "unplayed", "missing"]);
const FACET_AXES = new Set(["circle", "cv", "series", "cat", "year"]);

function isFacetAxis(a: AxisId): boolean { return FACET_AXES.has(a as string); }
function isSmartAxis(a: AxisId): boolean { return (a as string).startsWith("smart-"); }

interface LibraryViewProps {
  searchQuery: string;
  scanVersion: number;
  playingWorkId?: string;
  playingTrackIndex?: number;
  onPlay: (work: WorkSummary, trackIndex: number) => void;
}

export default function LibraryView({ searchQuery, scanVersion, playingWorkId, playingTrackIndex, onPlay }: LibraryViewProps) {
  const nav = useLibraryView();

  const [works, setWorks] = useState<WorkSummary[]>([]);
  const [facetItems, setFacetItems] = useState<AxisFacetItem[]>([]);
  const [smartFolders, setSmartFolders] = useState<SmartFolder[]>([]);
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  const [libraryTotal, setLibraryTotal] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  // ── Load smart folders once ─────────────────────────────
  useEffect(() => {
    api.listSmartFolders().then(setSmartFolders).catch(() => {});
  }, []);

  // ── Load works based on current navigation state ────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    if (isSmartAxis(nav.activeAxis)) {
      const sfId = (nav.activeAxis as string).slice("smart-".length);
      api.evalSmartFolder(sfId)
        .then((w) => {
          if (!cancelled) setWorks(w);
        })
        .catch(() => {
          if (!cancelled) setWorks([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    const params: api.WorksQueryParams = { sort: nav.sort };

    if (searchQuery) params.q = searchQuery;

    if (nav.activeAxis === "tag" && nav.selectedTags.length > 0) {
      params.tags = nav.selectedTags;
      params.tagOp = "AND";
    }

    if (VIEW_AXES.has(nav.activeAxis as string) && nav.activeAxis !== "all") {
      params.view = nav.activeAxis as string;
    }

    if (isFacetAxis(nav.activeAxis) && nav.drillValue) {
      params.axis = nav.activeAxis as string;
      params.axisValue = nav.drillValue;
    }

    api.searchWorksV2(params)
      .then((w) => {
        if (!cancelled) setWorks(w);
      })
      .catch(() => {
        if (!cancelled) setWorks([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nav.activeAxis, nav.drillValue, nav.selectedTags, nav.sort, searchQuery, scanVersion]);

  // ── Load library total for axis header ───────────────────
  useEffect(() => {
    api.searchWorksV2({}).then((w) => setLibraryTotal(w.length)).catch(() => {});
  }, [scanVersion]);

  // ── Load facet items when entering a facet axis ─────────
  useEffect(() => {
    if (!isFacetAxis(nav.activeAxis) || nav.drillValue) { setFacetItems([]); return; }
    api.getAxisFacets(nav.activeAxis as string)
      .then(setFacetItems)
      .catch(() => setFacetItems([]));
  }, [nav.activeAxis, nav.drillValue, scanVersion]);

  // ── Load tag list for tag axis ──────────────────────────
  useEffect(() => {
    if (nav.activeAxis !== "tag") return;
    api.getAxisFacets("tag").then(setFacetItems).catch(() => setFacetItems([]));
  }, [nav.activeAxis, scanVersion]);

  // ── Load selected work detail ────────────────────────────
  useEffect(() => {
    if (!nav.selectedWorkId) { setSelectedWork(null); return; }
    api.getWork(nav.selectedWorkId).then(setSelectedWork).catch(() => setSelectedWork(null));
  }, [nav.selectedWorkId]);

  // ── Determine preview mode ───────────────────────────────
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
        totalCount={libraryTotal}
        smartFolders={smartFolders}
        onSelectAxis={nav.setAxis}
        onNewSmartFolder={() => {
          const name = window.prompt("スマートフォルダー名:");
          if (!name) return;
          api.createSmartFolder({ name, rules: [], sort: "added-desc" })
            .then((sf) => setSmartFolders((prev) => [...prev, sf]))
            .catch(() => {});
        }}
      />

      <ContentColumn
        axis={nav.activeAxis}
        drillValue={nav.drillValue}
        works={works}
        facetItems={facetItems}
        selectedWorkId={nav.selectedWorkId}
        selectedTags={nav.selectedTags}
        playingWorkId={playingWorkId}
        isLoading={isLoading}
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
