import { useEffect, useState } from "react";

/**
 * 現在開いている最前面の <dialog> 要素を追跡する。showModal()/close() は "open" 属性を
 * 出し入れするため（useDialogModal 参照）、その変化を MutationObserver で拾う。
 * top layer 内の前後関係は表示タイミングの新しい方が手前になるため（design-system.md）、
 * DOM順で最後に開いているものを最前面として扱う。
 *
 * showModal() 中の dialog はブラウザが dialog 以外の全体を暗黙に inert 化するため、
 * document.body 直下にポータルされた要素（popover含む）はクリックが通らなくなる。
 * この値を使って body ではなく開いている dialog 自身の配下へポータル先を切り替えると、
 * inert 化の対象から外れる。
 */
export function useTopmostOpenModalDialog(): HTMLDialogElement | null {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);

  useEffect(() => {
    const update = () => {
      const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog:modal");
      setDialog(dialogs.length > 0 ? (dialogs[dialogs.length - 1] ?? null) : null);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["open"],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  return dialog;
}
