import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  activeAxisAtom,
  drillValueAtom,
  selectedTagsAtom,
  selectedWorkIdAtom,
  sortAtom,
} from "../../library/model/atoms";
import {
  filesDirectionAtom,
  filesRelPathAtom,
  filesSelectedPathAtom,
} from "../../files/model/atoms";
import { joinPath, relSegments } from "../../files/model/types";
import { useRootFolder } from "../../settings/useSettingsQuery";
import { appModeAtom } from "./navigationAtoms";
import { navigationHistoryCommitAtom, navigationHistoryStateAtom } from "./navigationHistoryAtoms";
import {
  parseNavigationUrl,
  serializeNavigationUrl,
  type NavigationParseResult,
  type NavigationUrlState,
} from "./navigationUrl";

const HISTORY_STATE_KEY = "__mimimilliNavigation";
const MAX_INDEX_KEY = "mimimilli.navigation.maxIndex";

interface HistoryMarker {
  index: number;
}

function readMarker(state: unknown): HistoryMarker | null {
  if (!state || typeof state !== "object") return null;
  const marker = (state as Record<string, unknown>)[HISTORY_STATE_KEY];
  if (!marker || typeof marker !== "object") return null;
  const index = (marker as Record<string, unknown>).index;
  return typeof index === "number" && Number.isInteger(index) && index >= 0 ? { index } : null;
}

function stateWithMarker(index: number): Record<string, unknown> {
  const current = history.state;
  const base = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
  return { ...base, [HISTORY_STATE_KEY]: { index } };
}

function readMaxIndex(currentIndex: number): number {
  const stored = Number.parseInt(sessionStorage.getItem(MAX_INDEX_KEY) ?? "", 10);
  return Number.isInteger(stored) && stored >= currentIndex ? stored : currentIndex;
}

function writeMaxIndex(index: number): void {
  sessionStorage.setItem(MAX_INDEX_KEY, String(index));
}

function warnForInvalidUrl(result: NavigationParseResult): void {
  for (const warning of result.warnings) {
    console.warn(`[navigation] ${warning}`);
  }
}

export function navigationHistoryBack(): void {
  window.history.back();
}

export function navigationHistoryForward(): void {
  window.history.forward();
}

export function useNavigationHistory(): void {
  const mode = useAtomValue(appModeAtom);
  const activeAxis = useAtomValue(activeAxisAtom);
  const drillValue = useAtomValue(drillValueAtom);
  const selectedTags = useAtomValue(selectedTagsAtom);
  const selectedWorkId = useAtomValue(selectedWorkIdAtom);
  const sort = useAtomValue(sortAtom);
  const filesRelPath = useAtomValue(filesRelPathAtom);
  const filesSelectedPath = useAtomValue(filesSelectedPathAtom);
  const commit = useAtomValue(navigationHistoryCommitAtom);

  const setMode = useSetAtom(appModeAtom);
  const setActiveAxis = useSetAtom(activeAxisAtom);
  const setDrillValue = useSetAtom(drillValueAtom);
  const setSelectedTags = useSetAtom(selectedTagsAtom);
  const setSelectedWorkId = useSetAtom(selectedWorkIdAtom);
  const setSort = useSetAtom(sortAtom);
  const setFilesRelPath = useSetAtom(filesRelPathAtom);
  const setFilesSelectedPath = useSetAtom(filesSelectedPathAtom);
  const setFilesDirection = useSetAtom(filesDirectionAtom);
  const setNavigationHistoryState = useSetAtom(navigationHistoryStateAtom);

  const rootFolder = useRootFolder();

  const rootFolderRef = useRef(rootFolder);
  rootFolderRef.current = rootFolder;
  const currentIndexRef = useRef(0);
  const maxIndexRef = useRef(0);
  const pendingFileSelectionRef = useRef<string[] | null>(null);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // 履歴インデックスは ref が唯一の保持先。派生の可否だけを atom へ公開する
  // （state を持って effect で atom へ写すと余分なレンダーが1往復増える）。
  const publishHistoryState = useCallback(() => {
    setNavigationHistoryState({
      canBack: currentIndexRef.current > 0,
      canForward: currentIndexRef.current < maxIndexRef.current,
    });
  }, [setNavigationHistoryState]);

  const applyParsedState = useCallback(
    (result: NavigationParseResult, fileDirection: 1 | -1 = 1) => {
      warnForInvalidUrl(result);
      const { state } = result;
      setMode(state.mode);

      if (state.mode === "library") {
        setActiveAxis(state.library.activeAxis);
        setDrillValue(state.library.drillValue);
        setSelectedTags(state.library.selectedTags);
        setSelectedWorkId(state.library.selectedWorkId);
        setSort(state.library.sort);
        return;
      }

      setFilesDirection(fileDirection);
      setFilesRelPath(state.files.relPath);
      pendingFileSelectionRef.current = state.files.selectedRelPath;
      const root = rootFolderRef.current;
      setFilesSelectedPath(
        root && state.files.selectedRelPath ? joinPath(root, state.files.selectedRelPath) : null,
      );
    },
    [
      setActiveAxis,
      setDrillValue,
      setFilesDirection,
      setFilesRelPath,
      setFilesSelectedPath,
      setMode,
      setSelectedTags,
      setSelectedWorkId,
      setSort,
    ],
  );

  useLayoutEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const marker = readMarker(history.state);
      const index = marker?.index ?? 0;
      const knownMax = marker ? readMaxIndex(index) : index;
      const parsed = parseNavigationUrl(window.location.href);
      const currentUrl = `${window.location.pathname}${window.location.search}`;

      currentIndexRef.current = index;
      maxIndexRef.current = knownMax;
      publishHistoryState();
      writeMaxIndex(knownMax);
      history.replaceState(
        stateWithMarker(index),
        "",
        parsed.canonicalUrl === currentUrl ? currentUrl : parsed.canonicalUrl,
      );
      applyParsedState(parsed);
      setReady(true);
    }

    const handlePopState = (event: PopStateEvent) => {
      const nextMarker = readMarker(event.state);
      const nextIndex = nextMarker?.index ?? 0;
      const fileDirection = nextIndex < currentIndexRef.current ? -1 : 1;
      const nextMax = Math.max(maxIndexRef.current, readMaxIndex(nextIndex));
      const nextParsed = parseNavigationUrl(window.location.href);
      const nextCurrentUrl = `${window.location.pathname}${window.location.search}`;

      currentIndexRef.current = nextIndex;
      maxIndexRef.current = nextMax;
      publishHistoryState();
      writeMaxIndex(nextMax);
      if (!nextMarker || nextParsed.canonicalUrl !== nextCurrentUrl) {
        history.replaceState(stateWithMarker(nextIndex), "", nextParsed.canonicalUrl);
      }
      applyParsedState(nextParsed, fileDirection);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [applyParsedState, publishHistoryState]);

  useEffect(() => {
    if (!rootFolder || pendingFileSelectionRef.current === null) return;
    setFilesSelectedPath(joinPath(rootFolder, pendingFileSelectionRef.current));
  }, [rootFolder, setFilesSelectedPath]);

  useEffect(() => {
    if (!ready) return;

    let state: NavigationUrlState;
    if (mode === "library") {
      state = {
        mode,
        library: { activeAxis, drillValue, selectedTags, selectedWorkId, sort },
      };
    } else {
      if (!rootFolder) return;
      let selectedRelPath: string[] | null = null;
      const pendingSelection = pendingFileSelectionRef.current;
      if (pendingSelection !== null) {
        selectedRelPath = pendingSelection;
        if (filesSelectedPath === joinPath(rootFolder, pendingSelection)) {
          pendingFileSelectionRef.current = null;
        }
      } else if (filesSelectedPath) {
        const candidate = relSegments(rootFolder, filesSelectedPath);
        if (joinPath(rootFolder, candidate) === filesSelectedPath) {
          selectedRelPath = candidate;
        } else {
          console.warn(`[navigation] root 外の選択パスを URL へ同期しません: ${filesSelectedPath}`);
        }
      }
      state = { mode, files: { relPath: filesRelPath, selectedRelPath } };
    }

    const nextUrl = serializeNavigationUrl(state);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === currentUrl) return;

    if (commit.kind === "push") {
      const nextIndex = currentIndexRef.current + 1;
      currentIndexRef.current = nextIndex;
      maxIndexRef.current = nextIndex;
      publishHistoryState();
      writeMaxIndex(nextIndex);
      history.pushState(stateWithMarker(nextIndex), "", nextUrl);
      return;
    }

    history.replaceState(stateWithMarker(currentIndexRef.current), "", nextUrl);
  }, [
    activeAxis,
    commit.kind,
    commit.revision,
    drillValue,
    filesRelPath,
    filesSelectedPath,
    mode,
    publishHistoryState,
    ready,
    rootFolder,
    selectedTags,
    selectedWorkId,
    sort,
  ]);
}
