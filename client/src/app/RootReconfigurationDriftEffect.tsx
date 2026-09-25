// 別クライアントが開始した再設定を、このタブがreconfiguringも409も観測しないまま
// 完了した場合に備える（ADR-0029のcompletedAt契約）。readyの間、settingsの
// rootFolder・completedAtを前回観測値と比較し、どちらかが変わっていたら
// （初回観測は基準を記録するだけで発火しない）離脱側後処理を呼ぶ。
import { useEffect, useRef } from "react";
import { useSettingsQuery } from "../entities/settings/useSettingsQuery";

interface RootReconfigurationBaseline {
  rootFolder: string | null;
  completedAt: string | null;
}

interface RootReconfigurationDriftEffectProps {
  onDrift: () => void;
}

export default function RootReconfigurationDriftEffect({
  onDrift,
}: RootReconfigurationDriftEffectProps) {
  const settingsQuery = useSettingsQuery();
  const baselineRef = useRef<RootReconfigurationBaseline | null>(null);

  useEffect(() => {
    const data = settingsQuery.data;
    if (!data || data.rootReconfiguration.status !== "idle") return;
    const current: RootReconfigurationBaseline = {
      rootFolder: data.rootFolder,
      completedAt: data.rootReconfiguration.completedAt,
    };
    const baseline = baselineRef.current;
    baselineRef.current = current;
    if (baseline === null) return;
    if (
      baseline.rootFolder === current.rootFolder &&
      baseline.completedAt === current.completedAt
    ) {
      return;
    }
    onDrift();
  }, [settingsQuery.data, onDrift]);

  return null;
}
