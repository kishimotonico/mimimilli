import type { Work } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";

interface WorkStatusWarningsProps {
  work: Work;
  onEdit: () => void;
}

export function WorkStatusWarnings({ work, onEdit }: WorkStatusWarningsProps) {
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
          </div>
        </div>
      )}

      {work.status === "error" && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">メタデータの読み込みに失敗しました</p>
            <p className="mle-prv__warn-text">
              {work.errorMessage ?? "詳細不明のエラーが発生しました。"}
            </p>
            <p className="mle-prv__warn-path">{work.physicalPath}</p>
          </div>
        </div>
      )}

      {(work.dlsite.status === "error" || work.dlsite.status === "not_found") && (
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
            <button
              type="button"
              className="mt-1 w-fit rounded-pill bg-paper-2 px-2.5 py-1 font-sans text-[10.5px] font-medium text-ink-1 hover:bg-paper-3 hover:text-ink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-acc focus-visible:outline-offset-2"
              onClick={onEdit}
            >
              連携設定を編集
            </button>
          </div>
        </div>
      )}
    </>
  );
}
