import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { HoverGroupTriggerHandlers } from "../../../shared/lib/useHoverGroupCoordinator";
import { I } from "../../../shared/ui/Icon";
import type { SidebarRow } from "../model/sidebarRows";

interface SidebarRowItemProps {
  row: SidebarRow;
  id: string;
  isActive: boolean;
  isOverlayOpen: boolean;
  onSelect: () => void;
  getTriggerHandlers: (key: string) => HoverGroupTriggerHandlers;
  openImmediately: (key: string, el: HTMLElement | null) => void;
}

export default function SidebarRowItem({
  row,
  id,
  isActive,
  isOverlayOpen,
  onSelect,
  getTriggerHandlers,
  openImmediately,
}: SidebarRowItemProps) {
  const rowRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!row.hasQuickOverlay || isOverlayOpen) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      openImmediately(row.id, rowRef.current);
    }
  };

  const Icon = I[row.icon];
  return (
    <button
      ref={rowRef}
      id={id}
      type="button"
      className={`mll-sbrow ${isActive ? "is-on" : ""}`}
      aria-current={isActive ? "true" : undefined}
      aria-expanded={row.hasQuickOverlay ? isOverlayOpen : undefined}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      {...(row.hasQuickOverlay ? getTriggerHandlers(row.id) : undefined)}
    >
      <Icon size={15} />
      <span className="nm">{row.name}</span>
      {row.count !== null && (
        <span className={`ct ${row.countTone === "error" ? "is-error" : ""}`}>{row.count}</span>
      )}
      {row.hasQuickOverlay && <I.chev size={12} className="chev" />}
    </button>
  );
}
