import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useAtom } from "jotai";
import { isPrimaryPointerButton } from "../../../shared/lib/pointerButton";
import { clampFilesPreviewWidth, filesPreviewWidthAtom } from "./previewLayoutAtoms";

export interface UseFilePreviewResizeResult {
  width: number;
  anchorRef: RefObject<HTMLDivElement | null>;
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizePointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/** ファイルプレビューパネルの左端ドラッグリサイズ。ドラッグ中は--files-prv-w CSS変数を直接書き換え、
 *  離した時点の値だけをatomへ確定する（毎フレームのatom更新による再描画を避ける）。 */
export function useFilePreviewResize(): UseFilePreviewResizeResult {
  const [width, setWidth] = useAtom(filesPreviewWidthAtom);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isPrimaryPointerButton(event)) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { startX: event.clientX, startWidth: width };
    },
    [width],
  );
  const onResizePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // プレビューは右側パネルなので、左（ポインタのマイナス方向）へ動かすほど幅が増える
    const next = clampFilesPreviewWidth(drag.startWidth + (drag.startX - event.clientX));
    anchorRef.current?.style.setProperty("--files-prv-w", `${next}px`);
  }, []);
  const onResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (!drag) return;
      const raw = anchorRef.current?.style.getPropertyValue("--files-prv-w") ?? "";
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed)) setWidth(clampFilesPreviewWidth(parsed));
    },
    [setWidth],
  );

  return { width, anchorRef, onResizePointerDown, onResizePointerMove, onResizePointerUp };
}
