import { useEffect, useRef, useState } from "react";
import { I } from "../../../shared/ui/Icon";

interface SetupScreenProps {
  onComplete: (path: string) => void;
  scanning: boolean;
  /** scanning 中の進捗ラベル（例: "作品を登録中 (3/12)"）。TASK-20: SSEで受信した進捗 */
  scanProgressLabel?: string | null;
}

export default function SetupScreen({
  onComplete,
  scanning,
  scanProgressLabel = null,
}: SetupScreenProps) {
  const [path, setPath] = useState("");
  const pathInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (scanning) return;
    pathInputRef.current?.focus({ preventScroll: true });
  }, [scanning]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (path.trim()) onComplete(path.trim());
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "var(--paper-0)",
        color: "var(--ink-0)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-jp)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          maxWidth: 480,
          width: "100%",
          padding: "0 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 9,
              background: "var(--ink-0)",
              color: "var(--paper-1)",
              display: "grid",
              placeItems: "center",
              fontFamily: "var(--font-sans)",
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.04em",
            }}
          >
            m
          </div>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: 24,
              letterSpacing: "-0.01em",
            }}
          >
            mimimilli
          </span>
        </div>

        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
          <h1
            style={{
              fontFamily: "var(--font-jp)",
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.005em",
              margin: 0,
            }}
          >
            ようこそ
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7, margin: 0 }}>
            音声作品が保存されているルートフォルダーを指定してください。
            <br />
            フォルダー内を自動でスキャンしてライブラリを構築します。
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 40,
              padding: "0 14px",
              background: "var(--paper-1)",
              border: "1px solid var(--line)",
              borderRadius: 8,
            }}
          >
            <I.folder size={14} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
            <input
              ref={pathInputRef}
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Users/yourname/Music/ASMR"
              style={{
                flex: 1,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--ink-0)",
                background: "none",
                border: "none",
                outline: "none",
              }}
              disabled={scanning}
            />
          </div>
          <button
            type="submit"
            disabled={!path.trim() || scanning}
            style={{
              height: 40,
              borderRadius: 8,
              background: path.trim() && !scanning ? "var(--ink-0)" : "var(--paper-3)",
              color: path.trim() && !scanning ? "var(--paper-1)" : "var(--ink-3)",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 13,
              border: "none",
              cursor: path.trim() && !scanning ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {scanning ? (
              <>
                <I.refresh size={14} className="animate-spin" />
                {scanProgressLabel ?? "スキャン中..."}
              </>
            ) : (
              <>
                <I.refresh size={14} /> スキャン開始
              </>
            )}
          </button>
        </form>

        <p style={{ fontSize: 11, color: "var(--ink-4)", textAlign: "center" }}>
          フォルダーパスはあとから設定で変更できます
        </p>
      </div>
    </div>
  );
}
