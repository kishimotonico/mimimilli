import { atom } from "jotai";

/** 現在 showModal() で開いている <dialog> のスタック。開いた順（末尾が最前面）で
 *  useDialogModal が push/pop する。useTopmostOpenModalDialog（shared/ui/）の唯一の情報源 */
export const openModalDialogsAtom = atom<HTMLDialogElement[]>([]);
