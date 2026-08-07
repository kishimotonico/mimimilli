import { useSyncExternalStore } from "react";
import type { HTMLMotionProps } from "motion/react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  const mql = window.matchMedia(REDUCED_MOTION_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * motion付属の useReducedMotion はマウント時の一度きりのスナップショットで、
 * その後の設定変更やモジュール単位のシングルトン状態を共有してしまう（テスト間で汚染しうる）ため使わない。
 * matchMedia を直接購読し、変更に反応する。
 */
function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
}

type MotionTarget = HTMLMotionProps<"div">["animate"];

/** motion-utils の EasingDefinition と構造的に一致させた型（内部パッケージのため直接importしない）。 */
type Ease =
  | readonly [number, number, number, number]
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "circIn"
  | "circOut"
  | "circInOut"
  | "backIn"
  | "backOut"
  | "backInOut"
  | "anticipate";

/** duration/delay を秒単位で表現する。 */
export interface PropertyTiming {
  duration: number;
  ease?: Ease;
  delay?: number;
}

export interface MotionVariant {
  initial: MotionTarget;
  animate: MotionTarget;
  exit: MotionTarget;
}

/** CSS `ease`（cubic-bezier(0.25, 0.1, 0.25, 1)）相当。 */
const EASE_STANDARD = [0.25, 0.1, 0.25, 1] as const;
/** CSS `ease-out`（cubic-bezier(0, 0, 0.2, 1)）相当。 */
const EASE_OUT = [0, 0, 0.2, 1] as const;
/** overshoot（バウンド）easing。dock-bar の入退場に使う。 */
const EASE_OVERSHOOT = [0.34, 1.2, 0.64, 1] as const;
/** Material 標準の減速カーブ。colstack / preview のスライドに使う。 */
const EASE_DECEL = [0.4, 0, 0.2, 1] as const;

const DUR = {
  fade: 0.15,
  fadeSlideUp: 0.15,
  collapse: 0.15,
  dockBarTransform: 0.32,
  dockBarOpacity: 0.2,
  dockSwitch: 0.18,
  popoverScale: 0.18,
  colstackWidth: 0.24,
  previewSlide: 0.22,
} as const;

const DOCK_WAIT_ENTER_DELAY_S = 0.18;

/** reduced=true のとき duration/delay を 0 にする。値そのもの（opacity 等）は変えない。 */
function timing(reduced: boolean, duration: number, ease?: Ease, delay = 0): PropertyTiming {
  return reduced ? { duration: 0, delay: 0 } : { duration, ease, delay };
}

export interface FadeOptions {
  /** 退出中に position:absolute で自身をレイアウトから外し、兄弟要素の詰まりを防ぐ。既定 true。 */
  exitAbsolute?: boolean;
}

/** opacity のみのフェード。既定で退出中は absolute 配置になり、兄弟のレイアウト膨張を防ぐ。 */
export function fadeVariant(reduced: boolean, opts: FadeOptions = {}): MotionVariant {
  const { exitAbsolute = true } = opts;
  const t = timing(reduced, DUR.fade, EASE_STANDARD);
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { opacity: t } },
    exit: {
      opacity: 0,
      pointerEvents: "none",
      transition: { opacity: t },
      ...(exitAbsolute ? { position: "absolute", top: 0, left: 0, right: 0 } : {}),
    },
  };
}

/** opacity + 上方向スライド（旧 fade-slide-up）。ポップオーバー等の出現に使う。 */
export function fadeSlideUpVariant(reduced: boolean): MotionVariant {
  const opacityT = timing(reduced, DUR.fadeSlideUp, EASE_STANDARD);
  const yT = timing(reduced, DUR.fadeSlideUp, EASE_STANDARD);
  return {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0, transition: { opacity: opacityT, y: yT } },
    exit: { opacity: 0, y: -8, pointerEvents: "none", transition: { opacity: opacityT, y: yT } },
  };
}

/** height: 0 ↔ "auto" + opacity。ルート要素に `overflow: hidden` を呼び出し側で付与すること。 */
export function collapseVariant(reduced: boolean): MotionVariant {
  const t = timing(reduced, DUR.collapse, EASE_STANDARD);
  return {
    initial: { height: 0, opacity: 0 },
    animate: { height: "auto", opacity: 1, transition: { height: t, opacity: t } },
    exit: { height: 0, opacity: 0, pointerEvents: "none", transition: { height: t, opacity: t } },
  };
}

/** PlayerDock のバー型が下から出入りする動き。 */
export function dockBarSlideVariant(reduced: boolean): MotionVariant {
  const yT = timing(reduced, DUR.dockBarTransform, EASE_OVERSHOOT);
  const opacityT = timing(reduced, DUR.dockBarOpacity, EASE_STANDARD);
  return {
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { y: yT, opacity: opacityT } },
    exit: {
      y: "100%",
      opacity: 0,
      pointerEvents: "none",
      transition: { y: yT, opacity: opacityT },
    },
  };
}

export interface WaitEnterOptions {
  /** true の間、入場（enter）側だけ180ms遅延させる。bar/popup 切替の入れ替わりに使う。退出には適用しない。 */
  waitEnter?: boolean;
}

/** PlayerDock のバー型 popup⇔bar 切替中（短い ease-out）。 */
export function dockBarSwitchVariant(reduced: boolean, opts: WaitEnterOptions = {}): MotionVariant {
  const enterDelay = opts.waitEnter ? DOCK_WAIT_ENTER_DELAY_S : 0;
  const enterT = timing(reduced, DUR.dockSwitch, EASE_OUT, enterDelay);
  const exitT = timing(reduced, DUR.dockSwitch, EASE_OUT);
  return {
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1, transition: { y: enterT, opacity: enterT } },
    exit: {
      y: "100%",
      opacity: 0,
      pointerEvents: "none",
      transition: { y: exitT, opacity: exitT },
    },
  };
}

/** PlayerDock のポップアップ型。transform-origin は常に bottom right（固定意匠）。 */
export function dockPopupScaleVariant(
  reduced: boolean,
  opts: WaitEnterOptions = {},
): MotionVariant {
  const enterDelay = opts.waitEnter ? DOCK_WAIT_ENTER_DELAY_S : 0;
  const enterT = timing(reduced, DUR.popoverScale, EASE_OUT, enterDelay);
  const exitT = timing(reduced, DUR.popoverScale, EASE_OUT);
  const transformOrigin = "bottom right";
  return {
    initial: { opacity: 0, scale: 0.85, transformOrigin },
    animate: {
      opacity: 1,
      scale: 1,
      transformOrigin,
      transition: { opacity: enterT, scale: enterT },
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      transformOrigin,
      pointerEvents: "none",
      transition: { opacity: exitT, scale: exitT },
    },
  };
}

export interface PopoverScaleOptions {
  /** 出現方向に応じた transform-origin（例: "top left"）。呼び出し側の意匠で決まるため必須。 */
  origin: string;
}

/** 汎用ポップオーバーの拡大縮小＋フェード。origin は呼び出し側が指定する。 */
export function popoverScaleVariant(reduced: boolean, opts: PopoverScaleOptions): MotionVariant {
  const t = timing(reduced, DUR.popoverScale, EASE_OUT);
  const { origin } = opts;
  return {
    initial: { opacity: 0, scale: 0.92, transformOrigin: origin },
    animate: {
      opacity: 1,
      scale: 1,
      transformOrigin: origin,
      transition: { opacity: t, scale: t },
    },
    exit: {
      opacity: 0,
      scale: 0.96,
      transformOrigin: origin,
      pointerEvents: "none",
      transition: { opacity: t, scale: t },
    },
  };
}

export interface ColstackWidthOptions {
  widthPx?: number;
}

/** FilesView の階層ナビ用エッジが幅方向に出入りする。ルート要素に `overflow: hidden` が必要。 */
export function colstackWidthVariant(
  reduced: boolean,
  opts: ColstackWidthOptions = {},
): MotionVariant {
  const { widthPx = 46 } = opts;
  const t = timing(reduced, DUR.colstackWidth, EASE_DECEL);
  return {
    initial: { width: 0, opacity: 0 },
    animate: { width: widthPx, opacity: 1, transition: { width: t, opacity: t } },
    exit: { width: 0, opacity: 0, pointerEvents: "none", transition: { width: t, opacity: t } },
  };
}

/** 作品選択プレビューが右から出入りする（ADR-0012 §3）。 */
export function previewSlideVariant(reduced: boolean): MotionVariant {
  const t = timing(reduced, DUR.previewSlide, EASE_DECEL);
  return {
    initial: { x: "100%" },
    animate: { x: 0, transition: { x: t } },
    exit: { x: "100%", pointerEvents: "none", transition: { x: t } },
  };
}

/**
 * variant トークンの唯一の入口。`prefers-reduced-motion: reduce` のとき、返す全 variant の
 * duration/delay を 0 にする（値そのものは変えないため opacity 等のアニメーションは瞬時に完了する）。
 * 各ビルダーは reduced を除いた純粋関数としても直接呼び出せる（ユニットテスト用）。
 */
export function useMotionVariants() {
  const reduced = useReducedMotion() ?? false;
  return {
    reduced,
    fade: (opts?: FadeOptions) => fadeVariant(reduced, opts),
    fadeSlideUp: () => fadeSlideUpVariant(reduced),
    collapse: () => collapseVariant(reduced),
    dockBarSlide: () => dockBarSlideVariant(reduced),
    dockBarSwitch: (opts?: WaitEnterOptions) => dockBarSwitchVariant(reduced, opts),
    dockPopupScale: (opts?: WaitEnterOptions) => dockPopupScaleVariant(reduced, opts),
    popoverScale: (opts: PopoverScaleOptions) => popoverScaleVariant(reduced, opts),
    colstackWidth: (opts?: ColstackWidthOptions) => colstackWidthVariant(reduced, opts),
    previewSlide: () => previewSlideVariant(reduced),
  };
}
