import { atom } from "jotai";
import { requestNavigationHistoryCommit } from "../../../shared/model/navigationHistoryCommit";
import {
  filesDirectionAtom,
  filesRelPathAtom,
  filesSelectedPathAtom,
} from "../../../entities/file-system/model/navigationAtoms";
import type { WorkspacePath } from "@mimimilli/shared";

export const openFilesDirAtom = atom(null, (_get, set, absPath: WorkspacePath) => {
  const nextRelPath = absPath ? absPath.split("/") : [];
  requestNavigationHistoryCommit(set, "push");
  set(filesDirectionAtom, 1);
  set(filesRelPathAtom, nextRelPath);
  set(filesSelectedPathAtom, absPath);
});

export const selectFilesEntryAtom = atom(null, (_get, set, absPath: WorkspacePath) => {
  requestNavigationHistoryCommit(set, "replace");
  set(filesSelectedPathAtom, absPath);
});

export const goToFilesSegmentAtom = atom(null, (get, set, index: number) => {
  const relPath = get(filesRelPathAtom);
  const selectedPath = get(filesSelectedPathAtom);
  if (index === relPath.length && selectedPath === null) return;
  requestNavigationHistoryCommit(set, "push");
  set(filesDirectionAtom, -1);
  set(filesRelPathAtom, relPath.slice(0, index));
  set(filesSelectedPathAtom, null);
});

export const goUpFilesAtom = atom(null, (get, set) => {
  const relPath = get(filesRelPathAtom);
  if (relPath.length === 0) return;
  requestNavigationHistoryCommit(set, "push");
  set(filesDirectionAtom, -1);
  set(filesRelPathAtom, relPath.slice(0, -1));
  set(filesSelectedPathAtom, null);
});
