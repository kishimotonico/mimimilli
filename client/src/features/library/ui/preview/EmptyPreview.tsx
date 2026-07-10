import { I } from "../../../../shared/ui/Icon";

interface EmptyPreviewProps {
  /** 検索語・軸ドリルの絞り込みが原因で一覧が0件になっている場合に案内を出す */
  showNoResultsHint?: boolean;
}

export function EmptyPreview({ showNoResultsHint = false }: EmptyPreviewProps) {
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
        textAlign: "center",
        padding: "0 16px",
      }}
    >
      <I.gridS size={28} />
      {showNoResultsHint ? (
        <>
          <span style={{ fontSize: 12 }}>作品が見つかりません</span>
          <span style={{ fontSize: 11 }}>検索条件を変えてみてください</span>
        </>
      ) : (
        <span style={{ fontSize: 12 }}>作品を選択してください</span>
      )}
    </div>
  );
}
