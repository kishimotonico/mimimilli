import { relativeToRoot, type Work, type WorkChange } from "@mimimilli/shared";

export interface WorkSnapshot {
  status: Work["status"];
  /** 作品情報ファイルのパス。エラーでも未解決パスで上書きされないので、移動の判定に使う */
  metaPath: string;
  /** 表示用の作品パス。errorの記録では未解決のパスになりうる */
  physicalPath: string;
  sourceRevision: string | null;
  mediaRevision: string | null;
  audioFileCount: number;
}

/** 前回のカタログ記録と今回の読み取りを比べ、既存作品に起きた変化の種類を返す。
 *  前回か今回がerrorの作品は要対応の側で扱うので変化なし（errorの記録はphysicalPathが未解決のパスで上書きされる。移動はmetaPathの比較で判定する）。
 *  revision未保存の記録は比較できないので変化とみなさない。 */
export function classifyWorkChanges(
  previous: WorkSnapshot,
  current: WorkSnapshot,
  root: string,
): WorkChange[] {
  if (previous.status === "error" || current.status === "error") return [];
  const changes: WorkChange[] = [];
  if (previous.metaPath !== current.metaPath) {
    changes.push({
      kind: "moved",
      from: relativeToRoot(previous.physicalPath, root),
      to: relativeToRoot(current.physicalPath, root),
    });
  }
  if (previous.sourceRevision !== null && previous.sourceRevision !== current.sourceRevision) {
    changes.push({ kind: "meta" });
  }
  if (previous.mediaRevision !== null && previous.mediaRevision !== current.mediaRevision) {
    changes.push({ kind: "files", audioDelta: current.audioFileCount - previous.audioFileCount });
  }
  return changes;
}
