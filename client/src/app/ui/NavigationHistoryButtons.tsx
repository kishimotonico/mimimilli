import { useAtomValue } from "jotai";
import { navigationHistoryAvailabilityAtom } from "../../entities/navigation/model/appRouteStore";
import {
  navigationHistoryBack,
  navigationHistoryForward,
} from "../../shared/model/useRouteHistorySync";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";

export default function NavigationHistoryButtons() {
  const { canBack, canForward } = useAtomValue(navigationHistoryAvailabilityAtom);

  return (
    <>
      <IconButton
        size="sm"
        icon={I.chevL}
        label="戻る"
        onClick={navigationHistoryBack}
        disabled={!canBack}
      />
      <IconButton
        size="sm"
        icon={I.chev}
        label="進む"
        onClick={navigationHistoryForward}
        disabled={!canForward}
      />
    </>
  );
}
