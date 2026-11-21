import { useEffect, useRef, useState } from "react";
import { pathBaseName, type ScanCandidateExclusion } from "@mimimilli/shared";
import { cn } from "../../../../../shared/lib/cn";
import { LIST_HEADING_ROW_CLASS } from "../listHeading";
import Button from "../../../../../shared/ui/Button";
import CollectionStatus from "../../../../../shared/ui/CollectionStatus";
import { I } from "../../../../../shared/ui/Icon";

const EXCLUDED_GRID_CLASS =
  "grid items-center gap-x-3 px-[18px] [grid-template-columns:minmax(0,1fr)_120px_60px]";

interface ExcludedListProps {
  exclusions: readonly ScanCandidateExclusion[];
  /** 除外済みを読めていない間は loading、失敗は error。読めたあとは loaded のまま */
  status: "loading" | "error" | "loaded";
  onRetry: () => void;
  onBack: () => void;
  onRestore: (path: string) => Promise<void>;
}

/** 除外した候補の一覧。行ごとに未登録の一覧へ戻せる。 */
export default function ExcludedList({
  exclusions,
  status,
  onRetry,
  onBack,
  onRestore,
}: ExcludedListProps) {
  const [restoring, setRestoring] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => backRef.current?.focus(), []);
  const restore = async (path: string) => {
    setRestoring(true);
    try {
      await onRestore(path);
      if (exclusions.length <= 1) backRef.current?.focus();
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[46px] shrink-0 items-center gap-2.5 px-[18px]">
        <Button
          ref={backRef}
          variant="quiet"
          className="px-[9px] font-normal"
          icon={I.chevL}
          onClick={onBack}
        >
          未登録
        </Button>
        <span className="font-jp text-body font-bold text-ink-0">
          除外済み{" "}
          {status === "loaded" && (
            <span className="font-mono font-normal text-ink-2">{exclusions.length}</span>
          )}
        </span>
      </div>
      {status === "loading" ? (
        <CollectionStatus variant="list" kind="loading" />
      ) : status === "error" ? (
        <CollectionStatus variant="list" kind="error" onRetry={onRetry} />
      ) : exclusions.length === 0 ? (
        <CollectionStatus variant="list" kind="empty" message="除外した候補はありません" />
      ) : (
        <>
          <div className={cn(EXCLUDED_GRID_CLASS, LIST_HEADING_ROW_CLASS)}>
            <span>フォルダー</span>
            <span>RJコード</span>
            <span />
          </div>
          <ul
            aria-label="除外済みの候補"
            className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0"
          >
            {exclusions.map(({ path, rjCode }) => (
              <li
                key={path}
                className={cn(
                  EXCLUDED_GRID_CLASS,
                  "h-[54px] border-b border-line-soft hover:bg-paper-2",
                )}
              >
                <span className="flex min-w-0 flex-col gap-px leading-[1.45]">
                  <span
                    className="truncate font-jp text-body text-ink-0"
                    title={pathBaseName(path)}
                  >
                    {pathBaseName(path)}
                  </span>
                  <span className="truncate font-mono text-secondary text-ink-2" title={path}>
                    {path}
                  </span>
                </span>
                <span className="font-mono text-body text-ink-1">{rjCode ?? "—"}</span>
                <Button
                  variant="ghost"
                  aria-label={`「${pathBaseName(path)}」を未登録に戻す`}
                  disabled={restoring}
                  onClick={() => void restore(path)}
                >
                  戻す
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
