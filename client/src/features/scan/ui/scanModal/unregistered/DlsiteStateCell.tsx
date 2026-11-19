import { I } from "../../../../../shared/ui/Icon";
import StatusLabel from "../../../../../shared/ui/StatusLabel";
import type { CandidateDlsiteDisplay } from "../../../model/unregisteredDlsite";

export default function DlsiteStateCell({ display }: { display: CandidateDlsiteDisplay }) {
  switch (display.state) {
    case "none":
      return null;
    case "fetching":
      return (
        <StatusLabel tone="work" icon={I.refresh} spinning>
          取得中
        </StatusLabel>
      );
    case "fetched":
      return (
        <StatusLabel tone="done" icon={I.check}>
          取得済み
        </StatusLabel>
      );
    case "not_found":
      return (
        <StatusLabel tone="attention" icon={I.err}>
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
