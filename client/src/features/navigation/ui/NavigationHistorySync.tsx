import { appRouteCodec } from "../../../entities/navigation/model/appRoute";
import { appRouteStore } from "../../../entities/navigation/model/appRouteStore";
import { useRouteHistorySync } from "../../../shared/model/useRouteHistorySync";

export default function NavigationHistorySync() {
  useRouteHistorySync(appRouteStore, appRouteCodec);
  return null;
}
