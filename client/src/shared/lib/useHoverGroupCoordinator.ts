import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { isPointInTriangle, type Point } from "./pointInTriangle";

// 「複数のトリガーが1つのポータル越しパネルを共有し、常に高々1つだけ開く」ホバーUI
// （軸レールのクイックオーバーレイ等）の意図判定を一元管理するグループコーディネーター。
// 各トリガー単独の開閉遅延・pointerイベント・トリガー⇄パネル間のタイマー共有という
// useHoverIntent の役割に加え、トリガーからパネルへの斜め移動が他のトリガーの上を
// 通過しても開閉が横取りされないよう、セーフトライアングル判定で他行の open 要求を
// 抑止する（参考: https://ics.media/entry/260803/）。

const DEFAULT_OPEN_DELAY_MS = 200;
const DEFAULT_CLOSE_DELAY_MS = 150;
const DEFAULT_TRIANGLE_IDLE_MS = 300;
const DEFAULT_TRIANGLE_PADDING_PX = 8;

export interface HoverGroupTriggerHandlers {
  onPointerEnter: () => void;
  onPointerLeave: (event: ReactPointerEvent) => void;
}

export interface HoverGroupPanelHandlers {
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export interface UseHoverGroupCoordinatorOptions {
  /** ホバー開始から開くまでの遅延（ms）。既定200ms */
  openDelayMs?: number;
  /** ポインタが離れてから閉じるまでの猶予（ms） */
  closeDelayMs?: number;
  /** セーフトライアングル内でポインタが静止したとみなす時間（ms） */
  triangleIdleMs?: number;
  /** セーフトライアングルの底辺（パネル近接辺）に加える上下の余白（px） */
  trianglePaddingPx?: number;
}

export interface UseHoverGroupCoordinatorResult {
  /** 現在開いているトリガーのキー */
  openKey: string | null;
  /** 現在開いているトリガーの要素（AxisQuickOverlay の anchorEl に渡す） */
  openAnchorEl: HTMLElement | null;
  /** パネルのDOM要素をこのrefへ代入する（セーフトライアングルの底辺の算出に使う） */
  panelElRef: React.RefObject<HTMLElement | null>;
  getTriggerHandlers: (key: string, el: HTMLElement | null) => HoverGroupTriggerHandlers;
  panelHandlers: HoverGroupPanelHandlers;
  /** 遅延なしで即座に開く（キーボード操作用） */
  openImmediately: (key: string, el: HTMLElement | null) => void;
  /** 遅延・セーフトライアングルを打ち切って即座に閉じる */
  close: () => void;
}

interface Triangle {
  apex: Point;
  top: Point;
  bottom: Point;
}

export function useHoverGroupCoordinator(
  options: UseHoverGroupCoordinatorOptions = {},
): UseHoverGroupCoordinatorResult {
  const {
    openDelayMs = DEFAULT_OPEN_DELAY_MS,
    closeDelayMs = DEFAULT_CLOSE_DELAY_MS,
    triangleIdleMs = DEFAULT_TRIANGLE_IDLE_MS,
    trianglePaddingPx = DEFAULT_TRIANGLE_PADDING_PX,
  } = options;

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openAnchorEl, setOpenAnchorEl] = useState<HTMLElement | null>(null);
  const openKeyRef = useRef<string | null>(null);
  const panelElRef = useRef<HTMLElement | null>(null);
  const panelHoveredRef = useRef(false);
  const hoveredTriggerRef = useRef<{ key: string; el: HTMLElement | null } | null>(null);
  const triangleRef = useRef<Triangle | null>(null);
  const openTimerRef = useRef<number | undefined>(undefined);
  const pendingOpenKeyRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const idleTimerRef = useRef<number | undefined>(undefined);
  // document への addEventListener/removeEventListener が常に同一の関数参照を指すよう、
  // 実処理は onDocumentPointerMoveRef 経由の間接呼び出しにする（トランポリン）。
  // stableOnDocumentPointerMove 自体はマウント時に一度だけ作られ、以降のレンダーでも
  // 参照が変わらない。
  const onDocumentPointerMoveRef = useRef<(event: PointerEvent) => void>(() => {});
  const stableOnDocumentPointerMove = useRef((event: PointerEvent) => {
    onDocumentPointerMoveRef.current(event);
  }).current;

  const clearOpenTimer = () => {
    window.clearTimeout(openTimerRef.current);
    openTimerRef.current = undefined;
    pendingOpenKeyRef.current = null;
  };
  const clearCloseTimer = () => {
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  };
  const disengageTriangleGuard = () => {
    if (!triangleRef.current) return;
    triangleRef.current = null;
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = undefined;
    document.removeEventListener("pointermove", stableOnDocumentPointerMove);
  };

  const commitOpen = (key: string, el: HTMLElement | null) => {
    clearOpenTimer();
    openKeyRef.current = key;
    setOpenKey(key);
    setOpenAnchorEl(el);
  };

  const scheduleOpenTimer = (key: string, el: HTMLElement | null) => {
    clearOpenTimer();
    pendingOpenKeyRef.current = key;
    openTimerRef.current = window.setTimeout(() => commitOpen(key, el), openDelayMs);
  };

  const scheduleCloseTimer = () => {
    clearOpenTimer();
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      openKeyRef.current = null;
      setOpenKey(null);
      setOpenAnchorEl(null);
    }, closeDelayMs);
  };

  const resolveAfterGuard = () => {
    const hovered = hoveredTriggerRef.current;
    if (hovered && hovered.key !== openKeyRef.current) {
      handleTriggerEnter(hovered.key, hovered.el);
      return;
    }
    if (!panelHoveredRef.current) scheduleCloseTimer();
  };

  const resetIdleTimer = () => {
    window.clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => {
      disengageTriangleGuard();
      resolveAfterGuard();
    }, triangleIdleMs);
  };

  function onDocumentPointerMove(event: PointerEvent) {
    const triangle = triangleRef.current;
    if (!triangle) return;
    const point: Point = { x: event.clientX, y: event.clientY };
    if (isPointInTriangle(point, triangle.apex, triangle.top, triangle.bottom)) {
      resetIdleTimer();
      return;
    }
    disengageTriangleGuard();
    resolveAfterGuard();
  }
  onDocumentPointerMoveRef.current = onDocumentPointerMove;

  const engageTriangleGuard = (apex: Point, panelRect: DOMRect) => {
    triangleRef.current = {
      apex,
      top: { x: panelRect.left, y: panelRect.top - trianglePaddingPx },
      bottom: { x: panelRect.left, y: panelRect.bottom + trianglePaddingPx },
    };
    resetIdleTimer();
    document.addEventListener("pointermove", stableOnDocumentPointerMove);
  };

  function handleTriggerEnter(key: string, el: HTMLElement | null) {
    hoveredTriggerRef.current = { key, el };
    if (triangleRef.current && key !== openKeyRef.current) return; // 抑止: 他行の open 要求
    clearCloseTimer();
    if (key === openKeyRef.current) {
      clearOpenTimer();
      return;
    }
    scheduleOpenTimer(key, el);
  }

  const handleTriggerLeave = (key: string, point: Point) => {
    if (hoveredTriggerRef.current?.key === key) hoveredTriggerRef.current = null;
    if (key !== openKeyRef.current) {
      if (pendingOpenKeyRef.current === key) clearOpenTimer();
      return;
    }
    const panelEl = panelElRef.current;
    if (!panelEl) {
      scheduleCloseTimer();
      return;
    }
    engageTriangleGuard(point, panelEl.getBoundingClientRect());
  };

  const getTriggerHandlers = (key: string, el: HTMLElement | null): HoverGroupTriggerHandlers => ({
    onPointerEnter: () => handleTriggerEnter(key, el),
    onPointerLeave: (event) => handleTriggerLeave(key, { x: event.clientX, y: event.clientY }),
  });

  const panelHandlers: HoverGroupPanelHandlers = {
    onPointerEnter: () => {
      panelHoveredRef.current = true;
      disengageTriangleGuard();
      clearCloseTimer();
    },
    onPointerLeave: () => {
      panelHoveredRef.current = false;
      scheduleCloseTimer();
    },
  };

  const openImmediately = (key: string, el: HTMLElement | null) => {
    clearOpenTimer();
    clearCloseTimer();
    disengageTriangleGuard();
    commitOpen(key, el);
  };

  const close = () => {
    clearOpenTimer();
    clearCloseTimer();
    disengageTriangleGuard();
    panelHoveredRef.current = false;
    openKeyRef.current = null;
    setOpenKey(null);
    setOpenAnchorEl(null);
  };

  useEffect(() => {
    return () => {
      clearOpenTimer();
      clearCloseTimer();
      disengageTriangleGuard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- アンマウント時のクリーンアップのみ
  }, []);

  return {
    openKey,
    openAnchorEl,
    panelElRef,
    getTriggerHandlers,
    panelHandlers,
    openImmediately,
    close,
  };
}
