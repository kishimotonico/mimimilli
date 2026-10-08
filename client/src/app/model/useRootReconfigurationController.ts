import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "jotai";
import { usePlayerActions } from "../../entities/player/model/usePlayerActions";
import { activeModalAtom } from "../../shared/model/activeModalAtom";
import { navigateAtom } from "../../entities/navigation/model/appRouteStore";
import { DEFAULT_APP_ROUTE } from "../../entities/navigation/model/appRoute";
import { scanCandidateHiddenPathsAtom } from "../../entities/scan/model/atoms";
import { scanJobStoreAtom } from "../../entities/scan/model/scanJobStore";
import { dlsiteBulkApplyOpenAtom } from "../../entities/dlsite/model/bulkAtoms";
import { dlsiteBulkStoreAtom } from "../../entities/dlsite/model/dlsiteBulkStore";
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
        closeDlsiteApplyDialog: () => store.set(dlsiteBulkApplyOpenAtom, false),
        scanJob: store.get(scanJobStoreAtom),
        dlsiteBulk: store.get(dlsiteBulkStoreAtom),
        navigateToDefaultRoute: () => store.set(navigateAtom, DEFAULT_APP_ROUTE, { replace: true }),
        clearScanCandidateHiddenPaths: () => store.set(scanCandidateHiddenPathsAtom, new Set()),
      }),
    [queryClient, store, stop],
  );
}
