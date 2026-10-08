// 通常UI（ready）と同じ枝でだけマウントされる。マウント時に突入済みなら離脱側の後処理を行い、
// ready中のsettings変化（別タブでの再設定完了。ADR-0029のcompletedAt契約）をcontrollerへ観測させる。
// readyの時点でロックは解除済みなので、通常UIのobserverが生きていても構わない。
import { useEffect, useSyncExternalStore } from "react";
import type { RootReconfigurationController } from "./model/rootReconfigurationController";
import { useSettingsQuery } from "../entities/settings/useSettingsQuery";

interface ReconfigurationReadyEffectProps {
  controller: RootReconfigurationController;
}

export default function ReconfigurationReadyEffect({
  controller,
}: ReconfigurationReadyEffectProps) {
  const settings = useSettingsQuery().data;
  const status = settings?.rootReconfiguration.status;

  const entryCount = useSyncExternalStore(controller.subscribeEntries, controller.getEntryCount);

  useEffect(() => {
    controller.readyUiMounted();
  }, [controller, entryCount, status]);

  useEffect(() => {
    controller.observeSettings(settings);
  }, [controller, settings]);

  return null;
}
