import { useEffect, useRef, useState } from "react";
import { pathBaseName } from "@mimimilli/shared";
import Button from "../../../../../shared/ui/Button";
import CollectionStatus from "../../../../../shared/ui/CollectionStatus";
import { I } from "../../../../../shared/ui/Icon";

interface ExcludedListProps {
  paths: readonly string[];
  onBack: () => void;
  onRestore: (path: string) => Promise<void>;
}

/** 除外した候補の一覧。行ごとに未登録の一覧へ戻せる。 */
export default function ExcludedList({ paths, onBack, onRestore }: ExcludedListProps) {
  const [restoring, setRestoring] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => backRef.current?.focus(), []);
  const restore = async (path: string) => {
    setRestoring(true);
    try {
      await onRestore(path);
      if (paths.length <= 1) backRef.current?.focus();
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line-soft px-[18px] py-2">
        <Button ref={backRef} variant="quiet" icon={I.arrowL} onClick={onBack}>
          未登録
        </Button>
        <span className="font-jp text-body font-semibold text-ink-0">
          除外済み <span className="font-mono font-normal text-ink-2">{paths.length}</span>
        </span>
      </div>
      {paths.length === 0 ? (
        <CollectionStatus variant="list" kind="empty" message="除外した候補はありません" />
      ) : (
        <ul
          aria-label="除外済みの候補"
          className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0"
        >
          {paths.map((path) => (
            <li
              key={path}
              className="flex items-center gap-3 border-b border-line-soft px-[18px] py-2"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-jp text-body text-ink-0" title={pathBaseName(path)}>
                  {pathBaseName(path)}
                </span>
                <span className="truncate font-mono text-secondary text-ink-2" title={path}>
                  {path}
                </span>
              </span>
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
      )}
    </div>
  );
}
