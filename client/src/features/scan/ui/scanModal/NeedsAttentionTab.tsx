import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import {
  workspacePath,
  type DataIntegrityWarning,
  type InvalidMetaFile,
  type ScanDiagnostic,
} from "@mimimilli/shared";
import { SCAN_QUERY_KEYS } from "../../../../entities/scan/queryKeys";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import { errorToastAtom } from "../../../../shared/model/errorToastAtom";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import Button from "../../../../shared/ui/Button";
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog";
import type { DlsiteNotificationModalKind } from "../../../../entities/dlsite/model/dlsiteNotificationModal";
import { reassignIdentityConflict } from "../../api";
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
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const setErrorToast = useSetAtom(errorToastAtom);

  const reassignMutation = useMutation({
    mutationFn: (path: string) => reassignIdentityConflict(workspacePath(path)),
    onSuccess: async () => {
      setReassignTarget(null);
      await queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.diagnostics() });
      await queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() });
    },
    onError: (cause) => {
      setErrorToast(apiErrorMessage(cause, "別作品としての取り込みに失敗しました"));
    },
  });

  if (rows.length === 0) {
    return <p className="font-jp text-body text-ink-2">要対応の項目はありません。</p>;
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
              <AttentionRow
                key={row.key}
                row={row}
                onOpenFiles={props.onOpenFiles}
                onOpenNotificationModal={props.onOpenNotificationModal}
                onReassign={setReassignTarget}
              />
            ))}
          </tbody>
        </table>
      </div>
      {reassignTarget && (
        <ConfirmDialog
          title="別作品として取り込む"
          message={`「${reassignTarget}」のWork IDを新しくして、別作品として取り込みます。再生履歴やタグなどのユーザー状態は引き継ぎません。`}
          confirmLabel="取り込む"
          onConfirm={() => reassignMutation.mutate(reassignTarget)}
          onCancel={() => setReassignTarget(null)}
        />
      )}
    </div>
  );
}

function AttentionRow({
  row,
  onOpenFiles,
  onOpenNotificationModal,
  onReassign,
}: {
  row: NeedsAttentionRow;
  onOpenFiles: (path: string) => void;
  onOpenNotificationModal: (kind: DlsiteNotificationModalKind) => void;
  onReassign: (path: string) => void;
}) {
  return (
    <tr>
      <td className="px-2.5 py-2 align-top text-ink-1 whitespace-nowrap">{KIND_LABEL[row.kind]}</td>
      <td className="mll-selectable px-2.5 py-2 align-top break-all font-mono text-caption text-ink-2">
        {row.kind === "identityConflict" ? (
          <ul className="flex flex-col gap-1">
            {row.paths.map((path, index) => (
              <li key={path}>
                <span className="mr-1 text-ink-4">{index === 0 ? "登録中:" : "重複:"}</span>
                {path}
              </li>
            ))}
          </ul>
        ) : row.kind === "invalidMetaFile" ? (
          row.path
        ) : (
          `${row.count}件の作品`
        )}
      </td>
      <td className="px-2.5 py-2 align-top text-ink-2">
        {row.kind === "identityConflict"
          ? `同じ Work ID（${row.workId}）を持つフォルダーが${row.paths.length}件あります。片方を別作品として取り込むか、不要な方のmimimilli.jsonを削除してください。`
          : row.kind === "invalidMetaFile"
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
        {row.kind === "identityConflict" ? (
          <div className="flex flex-col items-start gap-1">
            {row.paths.map((path) => (
              <div key={path} className="flex gap-1.5">
                <Button onClick={() => onOpenFiles(path)}>Filesで開く</Button>
                <Button variant="primary" onClick={() => onReassign(path)}>
                  別作品として取り込む
                </Button>
              </div>
            ))}
          </div>
        ) : row.kind === "invalidMetaFile" ? (
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
