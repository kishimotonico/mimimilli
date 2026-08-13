import type { DataIntegrityWarning, InvalidMetaFile, ScanDiagnostic } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";

export interface NeedsAttentionTabProps {
  identityConflicts: ScanDiagnostic[];
  invalidMetaFiles: InvalidMetaFile[];
  rjCodeMissingCount: number;
  dataIntegrityWarning: DataIntegrityWarning | undefined;
  onOpenFiles: (path: string) => void;
  onOpenRjCodeMissing: () => void;
}

interface AttentionRow {
  key: string;
  kind: string;
  target: string;
  detail: string;
  action: { label: string; onClick: () => void } | null;
}

function buildRows({
  identityConflicts,
  invalidMetaFiles,
  rjCodeMissingCount,
  dataIntegrityWarning,
  onOpenFiles,
  onOpenRjCodeMissing,
}: NeedsAttentionTabProps): AttentionRow[] {
  const rows: AttentionRow[] = [];

  for (const conflict of identityConflicts) {
    conflict.paths.forEach((path, index) => {
      rows.push({
        key: `${conflict.workId}-${path}`,
        kind: "ID重複",
        target: path,
        detail: index === 0 ? `workId: ${conflict.workId}` : "競合相手",
        action: { label: "Filesで開く", onClick: () => onOpenFiles(path) },
      });
    });
  }

  for (const metaFile of invalidMetaFiles) {
    rows.push({
      key: metaFile.path,
      kind: "読み取り失敗",
      target: metaFile.path,
      detail: metaFile.message,
      action: { label: "Filesで開く", onClick: () => onOpenFiles(metaFile.path) },
    });
  }

  if (rjCodeMissingCount > 0) {
    rows.push({
      key: "rj-code-missing",
      kind: "RJコード未検出",
      target: `${rjCodeMissingCount}件の作品`,
      detail: "フォルダー名からRJコードを検出できませんでした",
      action: { label: "一覧を見る", onClick: onOpenRjCodeMissing },
    });
  }

  if (dataIntegrityWarning) {
    rows.push({
      key: "data-integrity",
      kind: "データ不整合",
      target: `${dataIntegrityWarning.skippedCount}件の作品`,
      detail: "タグ等の不整合のため除外されました",
      action: null,
    });
  }

  return rows;
}

export default function NeedsAttentionTab(props: NeedsAttentionTabProps) {
  const rows = buildRows(props);

  if (rows.length === 0) {
    return <p className="font-jp text-[12px] text-ink-3">要対応の項目はありません。</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-jp text-[11.5px] text-ink-2">
        自動では直しません。内容を確認してから対応してください。
      </p>
      <div className="overflow-hidden rounded-[6px] border border-line-soft">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-paper-0 text-left">
              <th className="border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2">
                種類
              </th>
              <th className="border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2">
                対象
              </th>
              <th className="border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2">
                内容
              </th>
              <th className="border-b border-line-soft px-2.5 py-1.5 font-sans font-semibold text-ink-2">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-2.5 py-2 align-top text-ink-1 whitespace-nowrap">{row.kind}</td>
                <td className="mll-selectable px-2.5 py-2 align-top break-all font-mono text-[10px] text-ink-3">
                  {row.target}
                </td>
                <td className="px-2.5 py-2 align-top text-ink-2">{row.detail}</td>
                <td className="px-2.5 py-2 align-top whitespace-nowrap">
                  {row.action ? (
                    <Button onClick={row.action.onClick}>{row.action.label}</Button>
                  ) : (
                    <span className="text-ink-4">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
