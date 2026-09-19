import type { Work } from "@mimimilli/shared";
import { isDlsiteFetchFailed, isDlsiteParseFailed, isRjCodeMissing } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";
import Button from "../../../../shared/ui/Button";

interface WorkStatusWarningsProps {
  work: Work;
  onEdit: () => void;
  onDelete: () => void;
  onOpenFiles: () => void;
}

export function WorkStatusWarnings({
  work,
  onEdit,
  onDelete,
  onOpenFiles,
}: WorkStatusWarningsProps) {
  return (
    <>
      {work.status === "missing" && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">ファイルが見つかりません</p>
            <p className="mle-prv__warn-text">
              登録時のフォルダーが移動または削除された可能性があります。再生はできません。
            </p>
            <p className="mle-prv__warn-path">{work.physicalPath}</p>
            <div className="mt-1 flex w-fit gap-1.5">
              <Button variant="ghost" size="sm" icon={I.folderO} onClick={onOpenFiles}>
                Filesで開く
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[color:var(--r-coral)]"
                onClick={onDelete}
              >
                登録を解除
              </Button>
            </div>
          </div>
        </div>
      )}

      {work.status === "error" && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">メタデータの読み込みに失敗しました</p>
            <p className="mle-prv__warn-text">
              作品フォルダーのファイルが壊れているか、対応していない形式の可能性があります。ファイルを直して再スキャンすると復帰します。
            </p>
            <p className="mle-prv__warn-text">
              {work.errorMessage ?? "詳細不明のエラーが発生しました。"}
            </p>
            <p className="mle-prv__warn-path">{work.physicalPath}</p>
            <div className="mt-1 flex w-fit gap-1.5">
              <Button variant="ghost" size="sm" icon={I.folderO} onClick={onOpenFiles}>
                Filesで開く
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[color:var(--r-coral)]"
                onClick={onDelete}
              >
                登録を解除
              </Button>
            </div>
          </div>
        </div>
      )}

      {isRjCodeMissing(work.dlsite) && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">DLsite未連携（RJコード未検出）</p>
            <p className="mle-prv__warn-text">
              フォルダー名からRJコードを自動検出できませんでした。RJコードを入力して取得するか、連携しない設定にできます。
            </p>
            <Button variant="ghost" size="sm" className="mt-1 w-fit" onClick={onEdit}>
              連携設定を編集
            </Button>
          </div>
        </div>
      )}

      {isDlsiteParseFailed(work.dlsite) && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">DLsiteのページ構造が変わった可能性があります</p>
            <p className="mle-prv__warn-text">
              {work.dlsite.error ?? "作品ページのHTMLをパースできませんでした。"}
            </p>
            <Button variant="ghost" size="sm" className="mt-1 w-fit" onClick={onEdit}>
              連携設定を編集
            </Button>
          </div>
        </div>
      )}

      {isDlsiteFetchFailed(work.dlsite) && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">
              {work.dlsite.status === "not_found"
                ? "DLsiteで作品が見つかりませんでした"
                : "DLsite情報の取得に失敗しました"}
            </p>
            <p className="mle-prv__warn-text">
              {work.dlsite.error ??
                (work.dlsite.status === "not_found"
                  ? "RJコードを確認してください。"
                  : "時間をおいて再試行してください。")}
            </p>
            <Button variant="ghost" size="sm" className="mt-1 w-fit" onClick={onEdit}>
              連携設定を編集
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
