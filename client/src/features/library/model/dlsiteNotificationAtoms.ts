import { atom } from "jotai";

export type DlsiteNotificationModalKind = "rj-missing" | "fetch-failed" | "parse-failed";

export const dlsiteNotificationModalAtom = atom<DlsiteNotificationModalKind | null>(null);

export const openDlsiteNotificationModalAtom = atom(
  null,
  (_get, set, kind: DlsiteNotificationModalKind) => {
    set(dlsiteNotificationModalAtom, kind);
  },
);

export const closeDlsiteNotificationModalAtom = atom(null, (_get, set) => {
  set(dlsiteNotificationModalAtom, null);
});
