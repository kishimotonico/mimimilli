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
  /** 保存の応答待ち。入力欄は値を変えられない */
  saving: boolean;
  onStartEdit: () => void;
  onCommit: (value: string) => RjCodeCommitResult;
  onCancel: () => void;
}

const CELL_BOX = "box-border w-full min-w-0 rounded-[6px] px-[7px] font-mono text-body";

export default function RjCodeCell({
  rjCode,
  editing,
  error,
  disabled,
  saving,
  onStartEdit,
  onCommit,
  onCancel,
}: RjCodeCellProps) {
  const message = error && (
    <span role="alert" className="truncate font-jp text-caption text-[var(--state-danger)]">
      {error.message}
    </span>
  );
  if (editing) {
    return (
      <>
        <RjCodeInput
          initialValue={error ? error.value : (rjCode ?? "")}
          invalid={Boolean(error)}
          readOnly={saving}
          onCommit={onCommit}
          onCancel={onCancel}
        />
        {message}
      </>
    );
  }
  const shown = error ? error.value : rjCode;
  return (
    <>
      <RjCodeButton
        shown={shown}
        invalid={Boolean(error)}
        disabled={disabled}
        onStartEdit={onStartEdit}
      />
      {message}
    </>
  );
}

function RjCodeButton({
  shown,
  invalid,
  disabled,
  onStartEdit,
}: {
  shown: string | null;
  invalid: boolean;
  disabled: boolean;
  onStartEdit: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onStartEdit}
      title="クリックしてRJコードを編集"
      style={{ height: RJ_CELL_HEIGHT }}
      className={cn(
        CELL_BOX,
        "border border-transparent text-left hover:bg-paper-2",
        invalid ? "text-[var(--state-danger)]" : shown ? "text-ink-1" : "text-ink-3",
      )}
    >
      {shown ?? "—"}
    </button>
  );
}

function RjCodeInput({
  initialValue,
  invalid,
  readOnly,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  invalid: boolean;
  readOnly: boolean;
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
      readOnly={readOnly}
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
