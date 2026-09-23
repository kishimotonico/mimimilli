import type { WorkEditSnapshot, WorkProjection, WorkSourceMutationResult } from "@mimimilli/shared";

/**
 * 作品編集ダイアログの保存結果の解釈をここへ集める。PATCH /api/works/:id は
 * {snapshot, projection} を返す。source確定（snapshotの確定）とcatalog反映
 * （projection）は別の事実であり、projectionがpendingでも保存（source確定）は
 * 成功として扱う（ADR-0025）。
 */
export interface WorkEditSaveOutcome {
  snapshot: WorkEditSnapshot;
  projection: WorkProjection;
}

export function interpretWorkEditSaveResult(result: WorkSourceMutationResult): WorkEditSaveOutcome {
  return { snapshot: result.snapshot, projection: result.projection };
}
