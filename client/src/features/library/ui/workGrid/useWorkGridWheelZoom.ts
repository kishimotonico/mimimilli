import { useEffect, type RefObject } from "react";
import { clampTileSize } from "../../model/gridSizing";

export function useWorkGridWheelZoom(
  paneRef: RefObject<HTMLElement | null>,
  safeTileSize: number,
  setTileSize: (size: number) => void,
) {
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setTileSize(clampTileSize(safeTileSize - event.deltaY * 0.1));
    };

    pane.addEventListener("wheel", handleWheel, { passive: false });
    return () => pane.removeEventListener("wheel", handleWheel);
  }, [paneRef, setTileSize, safeTileSize]);
}
