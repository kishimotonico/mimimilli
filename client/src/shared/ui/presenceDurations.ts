import type { PresenceVariant } from "./Presence";

/** CSS トランジションの最長 duration（ms）。退出保持はタイマー主導でこれに合わせる */
export const PRESENCE_DURATION_MS: Record<PresenceVariant, number> = {
  fade: 150,
  "fade-slide-up": 150,
  collapse: 150,
  "dock-bar-slide": 320,
  "dock-bar-switch": 180,
  "dock-popup-scale": 180,
  "colstack-width": 240,
  "preview-slide": 220,
};

export const DEFAULT_PRESENCE_DURATION_MS = 150;
