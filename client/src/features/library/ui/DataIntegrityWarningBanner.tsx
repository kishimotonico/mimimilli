import { I } from "../../../shared/ui/Icon";

export function DataIntegrityWarningBanner({ skippedCount }: { skippedCount: number }) {
  if (skippedCount <= 0) return null;
  return (
    <output className="flex items-center gap-2 overflow-hidden rounded-[6px] border border-[color-mix(in_oklch,var(--r-mustard)_35%,transparent)] bg-[color-mix(in_oklch,var(--r-mustard)_10%,transparent)] px-3 py-2">
      <I.err size={13} className="shrink-0 text-[var(--r-mustard)]" />
      <span className="font-jp text-[12px] text-ink-0">
        {skippedCount}件の作品がデータ不整合のため除外されました
      </span>
    </output>
  );
}
