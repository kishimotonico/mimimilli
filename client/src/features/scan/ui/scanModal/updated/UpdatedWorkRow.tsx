/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストの行は絶対配置の div で組むため、tr/td ではなく role=row/cell で ARIA table 構造を与える */
import type { WorkChange, WorkListItem, WorkspacePath } from "@mimimilli/shared";
import { cn } from "../../../../../shared/lib/cn";
import { describeWorkChanges } from "../../../model/describeWorkChange";
import { PathLink, WorkTitleLink } from "../ScanLinks";
import { UPDATED_GRID_CLASS } from "./layout";

interface UpdatedWorkRowProps {
  work: WorkListItem;
  changes: readonly WorkChange[];
  onOpenFiles: (path: WorkspacePath) => void;
  onOpenWorkDetail: (workId: string) => void;
}

export default function UpdatedWorkRow({
  work,
  changes,
  onOpenFiles,
  onOpenWorkDetail,
}: UpdatedWorkRowProps) {
  return (
    <div
      role="row"
      className={cn(UPDATED_GRID_CLASS, "items-start border-b border-line-soft py-2")}
    >
      <div role="cell" className="flex min-w-0 flex-col gap-0.5">
        <WorkTitleLink workId={work.id} title={work.title} onOpen={onOpenWorkDetail} />
        <PathLink path={work.relativePath} onOpen={onOpenFiles} />
      </div>
      <div role="cell" className="flex min-w-0 flex-col gap-1">
        {describeWorkChanges(changes).map((change) => (
          <div
            key={change.kind}
            className="flex min-w-0 items-center gap-1.5 font-jp text-secondary text-ink-1"
          >
            <change.icon size={12} className="shrink-0 text-ink-3" />
            <span className="shrink-0">{change.label}</span>
            {change.detail && (
              <span
                title={change.title}
                className="min-w-0 truncate font-mono text-mono text-ink-3"
              >
                {change.detail}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
