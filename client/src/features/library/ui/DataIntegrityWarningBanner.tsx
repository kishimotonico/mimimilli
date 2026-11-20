import { useQuery } from "@tanstack/react-query";
import { scanDiagnosticsQueryOptions } from "../../../entities/scan/queryOptions";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";

const BANNER_CLASS =
  "flex items-center gap-2 overflow-hidden rounded-[6px] border border-[color-mix(in_oklch,var(--r-mustard)_35%,transparent)] bg-[color-mix(in_oklch,var(--r-mustard)_10%,transparent)] px-3 py-2";

/** 読み込み中は出さない。件数があれば除外された作品数、診断を取れなかったときは再試行つきの警告を出す */
export function DataIntegrityWarningBanner() {
  const diagnostics = useQuery(scanDiagnosticsQueryOptions);
  if (diagnostics.isError) {
    return (
      <output className={BANNER_CLASS}>
        <I.err size={13} className="shrink-0 text-[var(--r-mustard)]" />
        <span className="font-jp text-body text-ink-0">データ不整合を確認できません</span>
        <Button variant="ghost" onClick={() => void diagnostics.refetch()} className="ml-auto">
          再試行
        </Button>
      </output>
    );
  }
  const skippedCount = diagnostics.data?.dataIntegrityWorkIds.length ?? 0;
  if (skippedCount === 0) return null;
  return (
    <output className={BANNER_CLASS}>
      <I.err size={13} className="shrink-0 text-[var(--r-mustard)]" />
      <span className="font-jp text-body text-ink-0">
        {skippedCount}件の作品がデータ不整合のため除外されました
      </span>
    </output>
  );
}
