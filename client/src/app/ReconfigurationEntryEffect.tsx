// reconfiguring画面（RootConfigurationScreen）と同じ枝でだけマウントされる。
// Reactはツリーの差し替え（通常UI→reconfiguring画面）をコミットしてからeffectを
// 走らせるため、このマウント時点で通常UIのquery observerは確実に消えている（ADR-0029）。
import { useEffect } from "react";
import type { RootReconfigurationController } from "./model/rootReconfigurationController";

interface ReconfigurationEntryEffectProps {
  controller: RootReconfigurationController;
}

export default function ReconfigurationEntryEffect({
  controller,
}: ReconfigurationEntryEffectProps) {
  useEffect(() => {
    controller.reconfiguringUiMounted();
  }, [controller]);
  return null;
}
