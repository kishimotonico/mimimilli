import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "jotai";
import { usePlayerActions } from "../../entities/player/model/usePlayerActions";
import { activeModalAtom } from "../../shared/model/activeModalAtom";
import { navigateAtom } from "../../entities/navigation/model/appRouteStore";
import { DEFAULT_APP_ROUTE } from "../../entities/navigation/model/appRoute";
import { RESET } from "jotai/utils";
import { clearScanCandidateLocalState } from "../../entities/scan/model/atoms";
import { scanEntrySeenAtom } from "../../features/scan/model/scanEntrySeen";
import { scanJobStoreAtom } from "../../entities/scan/model/scanJobStore";
import {
  createRootReconfigurationController,
  type RootReconfigurationController,
} from "./rootReconfigurationController";

export function useRootReconfigurationController(): RootReconfigurationController {
  const queryClient = useQueryClient();
  const store = useStore();
  const { stop } = usePlayerActions();

  return useMemo(
    () =>
      createRootReconfigurationController({
        queryClient,
        stopPlayback: stop,
        closeActiveModal: () => store.set(activeModalAtom, null),
        scanJob: store.get(scanJobStoreAtom),
        navigateToDefaultRoute: () => store.set(navigateAtom, DEFAULT_APP_ROUTE, { replace: true }),
        clearScanCandidateLocalState: () => {
          clearScanCandidateLocalState(store);
          store.set(scanEntrySeenAtom, RESET);
        },
      }),
    [queryClient, store, stop],
  );
}
