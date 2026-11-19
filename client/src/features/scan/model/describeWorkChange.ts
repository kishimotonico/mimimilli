import type { WorkChange, WorkChangeKind } from "@mimimilli/shared";
import { I, type IconFC } from "../../../shared/ui/Icon";

export interface WorkChangeDescription {
  kind: WorkChangeKind;
  icon: IconFC;
  label: string;
  /** 旧パス → 新パスなどの補足（mono表示） */
  detail?: string;
  /** 省略時の全文 */
  title?: string;
}

export const WORK_CHANGE_KIND_ORDER: readonly WorkChangeKind[] = ["moved", "meta", "files"];

export const WORK_CHANGE_KIND_LABEL: Record<WorkChangeKind, string> = {
  moved: "移動",
  meta: "作品情報",
  files: "ファイル構成",
};

export const WORK_CHANGE_KIND_ICON: Record<WorkChangeKind, IconFC> = {
  moved: I.arrowR,
  meta: I.text,
  files: I.audio,
};

export function describeWorkChange(change: WorkChange): WorkChangeDescription {
  const icon = WORK_CHANGE_KIND_ICON[change.kind];
  switch (change.kind) {
    case "moved": {
      const detail = `${change.from} → ${change.to}`;
      return { kind: "moved", icon, label: "移動", detail, title: detail };
    }
    case "meta":
      return { kind: "meta", icon, label: "作品情報ファイルを更新" };
    case "files":
      if (change.audioDelta > 0)
        return { kind: "files", icon, label: `音声ファイル +${change.audioDelta}` };
      if (change.audioDelta < 0)
        return { kind: "files", icon, label: `音声ファイル −${-change.audioDelta}` };
      return { kind: "files", icon, label: "ファイル構成を更新" };
  }
}

/** 作品の変化を 移動 → 作品情報 → ファイル構成 の順に並べて文言にする */
export function describeWorkChanges(changes: readonly WorkChange[]): WorkChangeDescription[] {
  return WORK_CHANGE_KIND_ORDER.flatMap((kind) =>
    changes.filter((change) => change.kind === kind).map(describeWorkChange),
  );
}
