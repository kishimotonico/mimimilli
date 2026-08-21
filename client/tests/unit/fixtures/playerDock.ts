import { vi } from "vitest";
import type { ComponentProps } from "react";
import PlayerDock from "../../../src/features/player/ui/PlayerDock";

/** PlayerDock の必須propsを型どおりに生成する（テストでは大半が未使用のためデフォルトはvi.fn()）。 */
export function buildPlayerDockProps(
  overrides: Partial<ComponentProps<typeof PlayerDock>> = {},
): ComponentProps<typeof PlayerDock> {
  return {
    onShowPlayingWork: vi.fn(),
    ...overrides,
  };
}
