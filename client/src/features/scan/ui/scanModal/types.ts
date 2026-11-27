// スキャンモーダルの左リスト⇄各タブの境界契約。各タブは自分で必要なデータを読んで一覧の状態を導き、
// 親（ScanModal）へは縦タブの件数と着地タブの判定に要るもの以外を渡さない。

export type ScanTabKey = "unregistered" | "newWorks" | "needsAttention" | "updated";

/** サイドバーの並びであり、開いたときに件数のあるタブを探す順 */
export const SCAN_TAB_ORDER: ScanTabKey[] = [
  "unregistered",
  "needsAttention",
  "newWorks",
  "updated",
];

export const SCAN_TAB_LABEL: Record<ScanTabKey, string> = {
  unregistered: "未登録",
  newWorks: "新規作品",
  needsAttention: "要対応",
  updated: "更新済み",
};

/** UnregisteredTab が候補登録の成否をScanModalへ伝える契約。タイトルは追加した作品の名前 */
export interface CandidatesRegisteredResult {
  registeredTitles: string[];
  /** 追加できた作品のうち、カバー画像のキャッシュ以外の理由でカバーを適用できなかったもの */
  coverSkippedTitles: string[];
  /** 追加できた作品のうち、カバー画像がキャッシュに無くカバーを適用できなかったもの */
  coverNotCachedTitles: string[];
  failedCount: number;
  /** 追加のあとに取り直した、未登録に残る候補の件数。取り直せなかった・追加できたものがないときは null */
  remainingCandidates: number | null;
  /** 途中で止まったか（候補の変更など） */
  interrupted: boolean;
}
