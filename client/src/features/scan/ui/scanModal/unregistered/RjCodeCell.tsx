import { useEffect, useRef, useState } from "react";
import { cn } from "../../../../../shared/lib/cn";
import { useInlineEditKeyDown } from "../../../../../shared/ui/useInlineEditKeyDown";
import { RJ_CELL_HEIGHT } from "./layout";

export interface RjCodeFieldError {
  value: string;
  message: string;
}

export type RjCodeCommitResult = "done" | "invalid";

interface RjCodeCellProps {
  rjCode: string | null;
  editing: boolean;
  error: RjCodeFieldError | undefined;
  disabled: boolean;
  onStartEdit: () => void;
  onCommit: (value: string) => RjCodeCommitResult;
  onCancel: () => void;
}

const CELL_BOX = "box-border w-full min-w-0 rounded-[4px] px-1.5 font-mono text-mono";

export default function RjCodeCell({
  rjCode,
  editing,
  error,
  disabled,
  onStartEdit,
  onCommit,
  onCancel,
}: RjCodeCellProps) {
  if (editing) {
    return (
      <RjCodeInput
        initialValue={error ? error.value : (rjCode ?? "")}
        invalid={Boolean(error)}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }
  const shown = error ? error.value : rjCode;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onStartEdit}
      title={error?.message ?? "クリックしてRJコードを編集"}
      style={{ height: RJ_CELL_HEIGHT }}
      className={cn(
        CELL_BOX,
        "border border-transparent text-left hover:bg-paper-2",
        error ? "text-[var(--state-danger)]" : shown ? "text-ink-1" : "text-ink-3",
      )}
    >
      {shown ?? "—"}
    </button>
  );
}

function RjCodeInput({
  initialValue,
  invalid,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  invalid: boolean;
  onCommit: (value: string) => RjCodeCommitResult;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const commit = () => {
    // 不正値は編集のまま入力欄へフォーカスを戻す（blurのたびに毎回効かせる）
    if (onCommit(value) === "invalid") inputRef.current?.focus();
  };
  const handleKeyDown = useInlineEditKeyDown({ onCommit: commit, onCancel });

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      placeholder="RJコード"
      style={{ height: RJ_CELL_HEIGHT }}
      className={cn(
        CELL_BOX,
        "border bg-paper-2 text-ink-0",
        invalid ? "border-[var(--state-danger)]" : "border-acc",
      )}
    />
  );
}
