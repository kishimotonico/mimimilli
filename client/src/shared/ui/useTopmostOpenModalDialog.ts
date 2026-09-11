import { useAtomValue } from "jotai";
import { openModalDialogsAtom } from "../model/openModalDialogsAtom";

/**
 * 現在開いている最前面の <dialog> 要素を返す。showModal()/close() を呼ぶ
 * useDialogModal 自身が「開いているdialogのスタック」を openModalDialogsAtom で管理し
 * （開いた順、末尾が最前面）、このフックはその末尾を読むだけ。
 *
 * showModal() 中の dialog はブラウザが dialog 以外の全体を暗黙に inert 化するため、
 * document.body 直下にポータルされた要素（popover含む）はクリックが通らなくなる。
 * この値を使って body ではなく開いている dialog 自身の配下へポータル先を切り替えると、
 * inert 化の対象から外れる。
 */
export function useTopmostOpenModalDialog(): HTMLDialogElement | null {
  const openDialogs = useAtomValue(openModalDialogsAtom);
  return openDialogs.length > 0 ? (openDialogs[openDialogs.length - 1] ?? null) : null;
}
