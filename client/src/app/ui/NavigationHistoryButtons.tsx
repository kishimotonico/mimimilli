import { useAtomValue } from "jotai";
import {
  navigationHistoryBack,
  navigationHistoryForward,
} from "../../features/navigation/model/useNavigationHistory";
import { navigationHistoryStateAtom } from "../../shared/model/navigationHistoryAtoms";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";

export default function NavigationHistoryButtons() {
  const { canBack, canForward } = useAtomValue(navigationHistoryStateAtom);

  return (
    <>
      <IconButton
        size="sm"
        icon={I.arrowL}
        label="戻る"
        onClick={navigationHistoryBack}
        disabled={!canBack}
      />
      <IconButton
        size="sm"
        icon={I.arrowR}
        label="進む"
        onClick={navigationHistoryForward}
        disabled={!canForward}
      />
    </>
  );
}
