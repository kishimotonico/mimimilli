import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useAtom } from "jotai";
import { isPrimaryPointerButton } from "../../../shared/lib/pointerButton";
import {
  clampFilesPreviewWidth,
  filesPreviewWidthAtom,
  getEffectiveFilesPreviewWidthMax,
} from "./previewLayoutAtoms";

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

  // 一覧+プレビューを束ねる親（.mle-files-layout）の幅を追う。プレビューの実効上限は
  // この幅から一覧の最小幅を引いた値にする（狭い画面で一覧が最小幅を割り込まないため）。
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  useEffect(() => {
    const container = anchorRef.current?.parentElement;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry?.contentRect.width ?? null);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  const effectiveMax = getEffectiveFilesPreviewWidthMax(containerWidth);
  const displayWidth = clampFilesPreviewWidth(width, effectiveMax);

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isPrimaryPointerButton(event)) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragRef.current = { startX: event.clientX, startWidth: displayWidth };
    },
    [displayWidth],
  );
  const onResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      // プレビューは右側パネルなので、左（ポインタのマイナス方向）へ動かすほど幅が増える
      const next = clampFilesPreviewWidth(
        drag.startWidth + (drag.startX - event.clientX),
        effectiveMax,
      );
      anchorRef.current?.style.setProperty("--files-prv-w", `${next}px`);
    },
    [effectiveMax],
  );
  const onResizePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (!drag) return;
      const raw = anchorRef.current?.style.getPropertyValue("--files-prv-w") ?? "";
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed)) setWidth(clampFilesPreviewWidth(parsed, effectiveMax));
    },
    [setWidth, effectiveMax],
  );

  // displayWidth は保存値の復元時も実効上限を超えないようにする。atom自体は書き換えないため、
  // コンテナが再び広がれば保存していた幅にそのまま戻る。
  return {
    width: displayWidth,
    anchorRef,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerUp,
  };
}
