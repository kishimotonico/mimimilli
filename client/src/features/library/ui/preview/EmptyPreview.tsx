import { I } from "../../../../shared/ui/Icon";

export function EmptyPreview() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--ink-4)" }}>
      <I.gridS size={28} />
      <span style={{ fontSize: 12 }}>作品を選択してください</span>
    </div>
  );
}
