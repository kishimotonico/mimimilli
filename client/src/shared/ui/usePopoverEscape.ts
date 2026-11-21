import { useEffect, useRef } from "react";
import { useStore } from "jotai";
import { openModalDialogsAtom } from "../model/openModalDialogsAtom";

interface Entry {
  /** アンカーが属するダイアログ。無ければ null（ダイアログの外） */
  scope: HTMLDialogElement | null;
  close: () => void;
  /** 開いている最前面のモーダル。無ければ null */
  topmostModal: () => HTMLDialogElement | null;
}

const entries: Entry[] = [];

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return;
  const targetDialog = event.target instanceof Element ? event.target.closest("dialog") : null;
  const matching = entries.filter(
    (candidate) => candidate.scope === (targetDialog ?? candidate.topmostModal()),
  );
  const entry = matching[matching.length - 1];
  if (!entry) return;
  event.preventDefault();
  event.stopPropagation();
  entry.close();
}

function register(entry: Entry): () => void {
  if (entries.length === 0) document.addEventListener("keydown", handleKeyDown);
  entries.push(entry);
  return () => {
    entries.splice(entries.indexOf(entry), 1);
    if (entries.length === 0) document.removeEventListener("keydown", handleKeyDown);
  };
}

/**
 * 開いているポップオーバーが、ダイアログのEscapeより先にEscapeを受ける。
 * 受けるのは、キー入力の対象がアンカーと同じダイアログ（なければダイアログの外）にあるときだけで、
 * 対象がどのダイアログにも属さない（フォーカスが body）ときは最前面のモーダルを対象の持ち主とみなす。
 * 前面のダイアログの操作は奪わない。内側の要素が先に処理したEscapeは受けない。
 * 同じ範囲に複数開いているときは、あとから開いたものから閉じる。IME変換中は無視する。
 */
export function usePopoverEscape(
  isOpen: boolean,
  getAnchor: () => HTMLElement | null,
  onEscape: () => void,
): void {
  const getAnchorRef = useRef(getAnchor);
  getAnchorRef.current = getAnchor;
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;
  const store = useStore();

  useEffect(() => {
    if (!isOpen) return;
    return register({
      scope: getAnchorRef.current()?.closest("dialog") ?? null,
      close: () => onEscapeRef.current(),
      topmostModal: () => store.get(openModalDialogsAtom).slice(-1)[0] ?? null,
    });
  }, [isOpen, store]);
}
