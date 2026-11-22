import { useEffect } from "react";
import { useAtom, useAtomValue } from "jotai";
import { activeModalAtom } from "../../../shared/model/activeModalAtom";
import { layerAtom } from "../../../entities/navigation/model/appRouteStore";
import { librarySidebarOpenAtom } from "../model/sidebarAtoms";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

/** アドレスバー左端のサイドバー開閉ボタン。Ctrl+B（Mac は ⌘B）でも切り替える。入力欄では奪わない */
export default function SidebarToggleButton() {
  const [open, setOpen] = useAtom(librarySidebarOpenAtom);
  // 層が開いている間は、サイドバーが層の下に隠れているので受け付けない
  const dialogOpen = useAtomValue(activeModalAtom) !== null;
  const layerOpen = useAtomValue(layerAtom) !== null;
  const modalOpen = dialogOpen || layerOpen;

  useEffect(() => {
    if (modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey)
        return;
      if (e.defaultPrevented || isEditableTarget(e.target)) return;
      e.preventDefault();
      setOpen((current) => !current);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setOpen, modalOpen]);

  return (
    <IconButton
      size="sm"
      icon={I.panel}
      label="サイドバー"
      title="サイドバー (Ctrl+B)"
      active={open}
      className="!h-7 !w-7"
      onClick={() => setOpen((current) => !current)}
    />
  );
}
