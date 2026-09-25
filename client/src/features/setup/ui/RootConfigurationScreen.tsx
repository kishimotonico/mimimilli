// root未設定（初回セットアップ）・再設定中・再設定失敗の3状態を1画面にまとめる。
// 差分は見出し・説明文・alert・入力可否だけで、骨格（ロゴ・見出し・フォーム）は共通のため。
import { useEffect, useRef, useState } from "react";
import type { RootReconfigurationState, ScanProgressEvent } from "@mimimilli/shared";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import { formatScanProgressLabel } from "../../../entities/scan/model/scanProgressLabel";
import { formatUserError, type UserErrorDisplay } from "../../../shared/lib/formatUserError";

interface RootConfigurationScreenProps {
  state: RootReconfigurationState;
  onSubmit: (path: string) => Promise<void>;
}

const HEADING: Record<RootReconfigurationState["status"], string> = {
  idle: "ようこそ",
  running: "ライブラリを再構築しています",
  failed: "ライブラリの再構築に失敗しました",
};

function formatProgressLabel(progress: ScanProgressEvent | null): string {
  return formatScanProgressLabel(progress) ?? "構築中...";
}

export default function RootConfigurationScreen({ state, onSubmit }: RootConfigurationScreenProps) {
  const isIdle = state.status === "idle";
  const isRunning = state.status === "running";
  const isFailed = state.status === "failed";
  const [path, setPath] = useState(isIdle ? "" : state.rootFolder);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<UserErrorDisplay | null>(null);
  const pathInputRef = useRef<HTMLInputElement | null>(null);
  const alertDisplay: UserErrorDisplay | null =
    submitError ?? (isFailed ? { message: state.message, detail: null } : null);
  const canSubmit = Boolean(path.trim()) && !isSubmitting;

  useEffect(() => {
    if (isRunning || isSubmitting) return;
    pathInputRef.current?.focus({ preventScroll: true });
  }, [isRunning, isSubmitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim() || isSubmitting) return;
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(path.trim());
    } catch (error) {
      setSubmitError(
        formatUserError(
          error,
          isIdle ? "初回セットアップに失敗しました" : "ルートフォルダーの再設定に失敗しました",
        ),
      );
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
          <h1 className="m-0 font-jp text-[22px] font-semibold tracking-[-0.005em]">
            {HEADING[state.status]}
          </h1>
          {isIdle ? (
            <p className="m-0 text-[13px] leading-[1.7] text-ink-2">
              音声作品が保存されているルートフォルダーを指定してください。
              <br />
              フォルダー内を自動でスキャンしてライブラリを構築します。
            </p>
          ) : (
            <p className="m-0 text-[13px] leading-[1.7] text-ink-2">
              完了までLibrary・Filesは利用できません。
            </p>
          )}
        </div>

        {isRunning ? (
          <div className="flex w-full flex-col gap-3">
            <div className="flex h-10 items-center gap-2 rounded-[8px] border border-line bg-paper-1 px-[14px]">
              <I.folder size={14} className="shrink-0 text-ink-3" />
              <span className="mll-selectable min-w-0 flex-1 truncate font-mono text-xs text-ink-1">
                {state.rootFolder}
              </span>
            </div>
            <div className="flex h-10 items-center justify-center gap-2 rounded-[8px] bg-paper-2 text-[13px] font-semibold text-ink-1">
              <I.refresh size={14} className="animate-spin" />
              {formatProgressLabel(state.progress)}
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex w-full flex-col gap-3">
            <div className="flex h-10 items-center gap-2 rounded-[8px] border border-line bg-paper-1 px-[14px] focus-within:border-line-strong">
              <I.folder size={14} className="shrink-0 text-ink-3" />
              <input
                ref={pathInputRef}
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder={isIdle ? "/Users/yourname/Music/ASMR" : undefined}
                aria-label="ルートフォルダーのパス"
                className="min-w-0 flex-1 border-none bg-transparent font-mono text-xs text-ink-0"
                disabled={isSubmitting}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              disabled={!canSubmit}
              className="h-10 w-full justify-center gap-2 rounded-[8px] text-[13px] font-semibold"
            >
              {isSubmitting ? (
                <>
                  <I.refresh size={14} className="animate-spin" />
                  {isIdle ? "設定中..." : "再試行中..."}
                </>
              ) : (
                <>
                  <I.refresh size={14} /> {isIdle ? "スキャン開始" : "再試行"}
                </>
              )}
            </Button>
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
        )}

        {isIdle && (
          <p className="text-center text-caption text-ink-4">
            フォルダーパスはあとから設定で変更できます
          </p>
        )}
      </div>
    </div>
  );
}
