import type { DataIntegrityWarning, InvalidMetaFile, ScanDiagnostic } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import type { DlsiteNotificationModalKind } from "../../../../entities/dlsite/model/dlsiteNotificationModal";
import { buildNeedsAttentionRows, type NeedsAttentionRow } from "../../model/needsAttention";

export interface NeedsAttentionTabProps {
  identityConflicts: ScanDiagnostic[];
  invalidMetaFiles: InvalidMetaFile[];
  rjCodeMissingCount: number;
  dlsiteFetchFailedCount: number;
  dlsiteParseErrorCount: number;
  dlsiteParseErrorAlert: boolean;
  dataIntegrityWarning: DataIntegrityWarning | undefined;
  onOpenFiles: (path: string) => void;
  onOpenNotificationModal: (kind: DlsiteNotificationModalKind) => void;
}

const KIND_LABEL: Record<NeedsAttentionRow["kind"], string> = {
  identityConflict: "ID重複",
  invalidMetaFile: "読み取り失敗",
  rjCodeMissing: "RJコード未検出",
  dlsiteFetchFailed: "DLsite取得失敗",
  dlsiteParseFailed: "DLsiteパース失敗",
  dataIntegrity: "データ不整合",
};

export default function NeedsAttentionTab(props: NeedsAttentionTabProps) {
  const rows = buildNeedsAttentionRows(props);

  if (rows.length === 0) {
    return <p className="font-jp text-body text-ink-2">要対応の項目はありません。</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-jp text-secondary text-ink-2">
        自動では直しません。内容を確認してから対応してください。
      </p>
      <div className="overflow-hidden rounded-[6px] border border-line-soft">
        <table className="w-full border-collapse text-secondary">
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
              <AttentionRow
                key={row.key}
                row={row}
                onOpenFiles={props.onOpenFiles}
                onOpenNotificationModal={props.onOpenNotificationModal}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttentionRow({
  row,
  onOpenFiles,
  onOpenNotificationModal,
}: {
  row: NeedsAttentionRow;
  onOpenFiles: (path: string) => void;
  onOpenNotificationModal: (kind: DlsiteNotificationModalKind) => void;
}) {
  if (row.kind === "identityConflict") {
    return (
      <>
        {row.paths.map((path, index) => (
          <tr key={path}>
            <td className="px-2.5 py-2 align-top text-ink-1 whitespace-nowrap">
              {KIND_LABEL.identityConflict}
            </td>
            <td className="mll-selectable px-2.5 py-2 align-top break-all font-mono text-caption text-ink-2">
              {path}
            </td>
            <td className="px-2.5 py-2 align-top text-ink-2">
              {index === 0 ? `workId: ${row.workId}` : "競合相手"}
            </td>
            <td className="px-2.5 py-2 align-top whitespace-nowrap">
              <Button onClick={() => onOpenFiles(path)}>Filesで開く</Button>
            </td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <tr>
      <td className="px-2.5 py-2 align-top text-ink-1 whitespace-nowrap">{KIND_LABEL[row.kind]}</td>
      <td className="mll-selectable px-2.5 py-2 align-top break-all font-mono text-caption text-ink-2">
        {row.kind === "invalidMetaFile" ? row.path : `${row.count}件の作品`}
      </td>
      <td className="px-2.5 py-2 align-top text-ink-2">
        {row.kind === "invalidMetaFile"
          ? `${row.message}。mimimilli.jsonを直すか、削除して再スキャンしてください。`
          : row.kind === "rjCodeMissing"
            ? "フォルダー名からRJコードを検出できませんでした"
            : row.kind === "dlsiteFetchFailed"
              ? "DLsiteから作品情報を取得できませんでした"
              : row.kind === "dlsiteParseFailed"
                ? "DLsiteの応答を解析できませんでした"
                : "タグ等の不整合のため除外されました"}
      </td>
      <td className="px-2.5 py-2 align-top whitespace-nowrap">
        {row.kind === "invalidMetaFile" ? (
          <Button onClick={() => onOpenFiles(row.path)}>Filesで開く</Button>
        ) : row.kind === "rjCodeMissing" ? (
          <Button onClick={() => onOpenNotificationModal("rj-missing")}>一覧を見る</Button>
        ) : row.kind === "dlsiteFetchFailed" ? (
          <Button onClick={() => onOpenNotificationModal("fetch-failed")}>一覧を見る</Button>
        ) : row.kind === "dlsiteParseFailed" ? (
          <Button onClick={() => onOpenNotificationModal("parse-failed")}>一覧を見る</Button>
        ) : (
          <span className="text-ink-4">—</span>
        )}
      </td>
    </tr>
  );
}
