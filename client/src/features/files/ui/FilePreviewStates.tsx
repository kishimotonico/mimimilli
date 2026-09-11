import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";
import CollectionStatus from "../../../shared/ui/CollectionStatus";
import type { FileLoadError } from "../model/types";

export function EmptyPreview() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 12,
        color: "var(--ink-4)",
        minHeight: 240,
      }}
    >
      <I.folderO size={28} />
      <span style={{ fontSize: 12 }}>フォルダーまたはファイルを選択してください</span>
    </div>
  );
}

interface FileLoadErrorPreviewProps {
  kind: FileLoadError;
  path: string;
  hasAncestors: boolean;
  onGoUp: () => void;
  onGoRoot: () => void;
  onRetry: () => void;
}

/** 404（対象なし）と5xx/通信失敗（再試行可能）を区別して表示する（TASK-428.18 / files-A-01） */
export function FileLoadErrorPreview({
  kind,
  path,
  hasAncestors,
  onGoUp,
  onGoRoot,
  onRetry,
}: FileLoadErrorPreviewProps) {
  if (kind === "notFound") {
    return (
      <div className="mle-prv__body">
        <CollectionStatus
          variant="list"
          kind="empty"
          message="このフォルダーは見つかりません"
          hint="移動・削除された可能性があります。"
        />
        <p className="mle-fprev__path" style={{ textAlign: "center" }}>
          {path}
        </p>
        <div className="mle-fprev__actions" style={{ justifyContent: "center" }}>
          {hasAncestors && (
            <Button variant="ghost" onClick={onGoUp}>
              1つ上の階層へ
            </Button>
          )}
          <Button variant="ghost" onClick={onGoRoot}>
            ルートへ
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="mle-prv__body">
      <CollectionStatus variant="list" kind="error" onRetry={onRetry} />
    </div>
  );
}

interface MissingSelectionPreviewProps {
  path: string;
  onBack: () => void;
}

/**
 * カレントフォルダーの取得自体には成功したが、選択中パスがその中に存在しない場合の表示。
 * ライブラリのエラー詳細・スキャン要対応の「Filesで開く」（openPathInFilesAtom）は
 * 移動・削除済みの対象へ遷移することがあり、以前は選択解除扱いでカレントフォルダーの
 * プレビューへ黙って差し替わっていた（TASK-428.18）。
 */
export function MissingSelectionPreview({ path, onBack }: MissingSelectionPreviewProps) {
  return (
    <div className="mle-prv__body">
      <CollectionStatus
        variant="list"
        kind="empty"
        message="このファイルまたはフォルダーは見つかりません"
        hint="移動・削除された可能性があります。"
      />
      <p className="mle-fprev__path" style={{ textAlign: "center" }}>
        {path}
      </p>
      <div className="mle-fprev__actions" style={{ justifyContent: "center" }}>
        <Button variant="ghost" onClick={onBack}>
          この一覧の表示に戻る
        </Button>
      </div>
    </div>
  );
}
