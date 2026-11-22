import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { appModeAtom } from "../../../entities/navigation/model/appRouteStore";

/** サイドバーを出しているか。端末ごとに保存し、画面幅では切り替えない（ADR-0041） */
export const librarySidebarOpenAtom = atomWithStorage<boolean>(
  "mimimilli:librarySidebarOpen",
  true,
);

/** ライブラリ・作品詳細・再生中のいずれかにいる間だけ、サイドバーを出せる。ファイルは全幅 */
export const librarySidebarAvailableAtom = atom((get) => get(appModeAtom) !== "files");

export const librarySidebarVisibleAtom = atom(
  (get) => get(librarySidebarAvailableAtom) && get(librarySidebarOpenAtom),
);
