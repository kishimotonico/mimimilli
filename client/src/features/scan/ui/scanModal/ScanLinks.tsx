import type { WorkspacePath } from "@mimimilli/shared";
import { cn } from "../../../../shared/lib/cn";

const LINK_CLASS = "min-w-0 max-w-full truncate text-left underline-offset-2 hover:underline";

interface PathLinkProps {
  path: WorkspacePath;
  onOpen: (path: WorkspacePath) => void;
  /** 表示する文字列。省略時は path */
  display?: string;
  className?: string;
}

/** 押すとFilesでそのパスを開く。長いパスは先頭側を省略して末尾を残す */
export function PathLink({ path, onOpen, display = path, className }: PathLinkProps) {
  return (
    <button
      type="button"
      dir="rtl"
      title={`Filesで開く: ${path}`}
      onClick={() => onOpen(path)}
      className={cn(LINK_CLASS, "text-ink-2", className)}
    >
      <bdi className="font-mono text-mono leading-4">{display}</bdi>
    </button>
  );
}

interface WorkTitleLinkProps {
  workId: string;
  title: string;
  onOpen: (workId: string) => void;
  className?: string;
}

/** 押すと作品詳細ページを開く */
export function WorkTitleLink({ workId, title, onOpen, className }: WorkTitleLinkProps) {
  return (
    <button
      type="button"
      title="作品詳細を開く"
      onClick={() => onOpen(workId)}
      className={cn(LINK_CLASS, "font-jp text-body text-ink-0", className)}
    >
      {title}
    </button>
  );
}
