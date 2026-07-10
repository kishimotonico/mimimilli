import type { Work } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";

interface WorkStatusWarningsProps {
  work: Work;
}

export function WorkStatusWarnings({ work }: WorkStatusWarningsProps) {
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
    </>
  );
}
