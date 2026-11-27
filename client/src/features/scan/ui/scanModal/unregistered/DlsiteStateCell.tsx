import { I } from "../../../../../shared/ui/Icon";
import StatusLabel from "../../../../../shared/ui/StatusLabel";
import type { CandidateDlsiteDisplay } from "../../../model/unregisteredDlsite";

export default function DlsiteStateCell({
  display,
  hasCode,
}: {
  display: CandidateDlsiteDisplay;
  hasCode: boolean;
}) {
  switch (display.state) {
    case "none":
      return hasCode ? (
        <StatusLabel tone="none" className="text-ink-2">
          未取得
        </StatusLabel>
      ) : (
        <span className="font-jp text-secondary text-ink-3">—</span>
      );
    case "cover_missing":
      return (
        <StatusLabel tone="none" className="text-ink-2">
          カバー未取得
        </StatusLabel>
      );
    case "fetching":
      return (
        <StatusLabel tone="work" icon={I.refresh} spinning>
          取得中
        </StatusLabel>
      );
    case "fetched":
      return (
        <StatusLabel tone="done" icon={I.checkC}>
          取得済み
        </StatusLabel>
      );
    case "not_found":
      return (
        <StatusLabel tone="attention" icon={I.searchX}>
          該当なし
        </StatusLabel>
      );
    case "failed":
      return (
        <StatusLabel tone="attention" icon={I.err}>
          失敗
        </StatusLabel>
      );
  }
}
