import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import {
  scanningAtom,
  scanErrorAtom,
  scanProgressLabelAtom,
} from "../../../entities/scan/model/atoms";
import { useScanActions } from "../../../entities/scan/useScanActions";
import { formatUserError, type UserErrorDisplay } from "../../../shared/lib/formatUserError";

interface SetupScreenProps {
  onComplete: (path: string) => Promise<void>;
}

export default function SetupScreen({ onComplete }: SetupScreenProps) {
  const scanningFromJob = useAtomValue(scanningAtom);
  const scanProgressLabel = useAtomValue(scanProgressLabelAtom);
  const scanError = useAtomValue(scanErrorAtom);
  const { cancel } = useScanActions();
  const [path, setPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [setupError, setSetupError] = useState<UserErrorDisplay | null>(null);
  const pathInputRef = useRef<HTMLInputElement | null>(null);
  const scanning = isSubmitting || scanningFromJob;
  // scanErrorはuseScanJob側で既にformatUserErrorを通した分類済みメッセージ（詳細は持たない）
  const alertDisplay: UserErrorDisplay | null = scanError
    ? { message: scanError, detail: null }
    : setupError;
  const canSubmit = Boolean(path.trim()) && !scanning;

  useEffect(() => {
    if (scanning) return;
    pathInputRef.current?.focus({ preventScroll: true });
  }, [scanning]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim() || scanning) return;
    setSetupError(null);
    setIsSubmitting(true);
    try {
      await onComplete(path.trim());
    } catch (error) {
      setSetupError(formatUserError(error, "初回セットアップに失敗しました"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-paper-0 font-jp text-ink-0">
      <div className="flex w-full max-w-[480px] flex-col items-center gap-8 px-6">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-[9px] bg-ink-0 font-sans text-[20px] font-semibold tracking-[-0.04em] text-paper-1">
            m
          </div>
          <span className="font-sans text-2xl font-medium tracking-[-0.01em]">mimimilli</span>
        </div>

        <div className="flex flex-col gap-2 text-center">
          <h1 className="m-0 font-jp text-[22px] font-semibold tracking-[-0.005em]">ようこそ</h1>
          <p className="m-0 text-[13px] leading-[1.7] text-ink-2">
            音声作品が保存されているルートフォルダーを指定してください。
            <br />
            フォルダー内を自動でスキャンしてライブラリを構築します。
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="flex w-full flex-col gap-3">
          <div className="flex h-10 items-center gap-2 rounded-[8px] border border-line bg-paper-1 px-[14px] focus-within:border-line-strong">
            <I.folder size={14} className="shrink-0 text-ink-3" />
            <input
              ref={pathInputRef}
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Users/yourname/Music/ASMR"
              className="min-w-0 flex-1 border-none bg-transparent font-mono text-xs text-ink-0"
              disabled={scanning}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={!canSubmit}
            className="h-10 w-full justify-center gap-2 rounded-[8px] text-[13px] font-semibold"
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
          </Button>
          {scanning && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void cancel()}
              className="h-9 w-full justify-center rounded-[8px] border border-line bg-paper-1 text-control font-semibold text-ink-2 hover:bg-paper-1 hover:text-ink-2"
            >
              スキャンを中止
            </Button>
          )}
          {alertDisplay && (
            <div className="flex flex-col gap-1">
              <p role="alert" className="mll-selectable m-0 text-xs text-[var(--r-coral)]">
                {alertDisplay.message}
              </p>
              {alertDisplay.detail ? (
                <details className="w-full text-left">
                  <summary className="cursor-pointer text-secondary text-ink-3">
                    技術的な詳細
                  </summary>
                  <pre className="mll-selectable mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all text-left text-secondary text-ink-3">
                    {alertDisplay.detail}
                  </pre>
                </details>
              ) : null}
            </div>
          )}
        </form>

        <p className="text-center text-caption text-ink-4">
          フォルダーパスはあとから設定で変更できます
        </p>
      </div>
    </div>
  );
}
