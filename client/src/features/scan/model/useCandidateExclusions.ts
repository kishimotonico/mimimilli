import { useCallback } from "react";
import { pathBaseName, type ScanCandidateExclusion } from "@mimimilli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useToast } from "../../../shared/ui/useToast";
import {
  getScanCandidateExclusions,
  restoreScanCandidateExclusions,
} from "../../../entities/scan/api";
import { refreshScanCandidatesQuietly } from "../../../entities/scan/scanCandidatesCache";
import { excludeScanCandidates, SCAN_QUERY_KEYS } from "../api";
import { isCandidatesStale, STALE_MESSAGE } from "./candidatesStale";
import { formatWorkNames } from "./formatWorkNames";

const NO_EXCLUSIONS: ScanCandidateExclusion[] = [];

interface UseCandidateExclusionsOptions {
  onExcludeError: (message: string) => void;
}

/**
 * 候補の除外・復元と除外済みの一覧。復元は呼び出し元のタブがアンマウントされても完走し、
 * 結果（失敗を含む）はタブに依存しないトーストで伝える。
 */
export function useCandidateExclusions({ onExcludeError }: UseCandidateExclusionsOptions) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const exclusionsQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.candidateExclusions(),
    queryFn: getScanCandidateExclusions,
  });

  const refresh = useCallback(
    () =>
      Promise.all([
        refreshScanCandidatesQuietly(queryClient),
        queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.candidateExclusions() }),
      ]),
    [queryClient],
  );

  /** 戻せたら true。失敗はタブに依存しないエラートーストで伝える */
  const restore = useCallback(
    async (paths: string[]): Promise<boolean> => {
      try {
        await restoreScanCandidateExclusions(paths);
      } catch (error) {
        toast.show({
          message: apiErrorMessage(error, "元に戻せませんでした"),
          variant: "error",
          priority: "notice",
          dismissOnUnmount: false,
        });
        return false;
      }
      await refresh();
      return true;
    },
    [toast, refresh],
  );

  const excludeMutation = useMutation({
    mutationFn: ({ paths }: { paths: string[]; titles: string[] }) => excludeScanCandidates(paths),
    onSuccess: async (_void, { paths, titles }) => {
      toast.show({
        message: `${formatWorkNames(titles)}を除外しました`,
        variant: "success",
        actionLabel: "元に戻す",
        onAction: () =>
          void restore(paths).then((restored) => {
            if (restored) toast.dismiss();
          }),
        priority: "action",
        dismissOnUnmount: false,
      });
      await refresh();
    },
    onError: async (error) => {
      if (isCandidatesStale(error)) {
        onExcludeError(STALE_MESSAGE);
        await refreshScanCandidatesQuietly(queryClient);
        return;
      }
      onExcludeError(apiErrorMessage(error, "除外できませんでした"));
    },
  });

  const restoreFromList = useCallback(
    async (paths: string[]) => {
      if (!(await restore(paths))) return;
      toast.show({
        message: `${formatWorkNames(paths.map(pathBaseName))}を戻しました`,
        variant: "success",
        priority: "action",
        dismissOnUnmount: false,
      });
    },
    [restore, toast],
  );

  const status: "loading" | "error" | "loaded" =
    exclusionsQuery.data !== undefined ? "loaded" : exclusionsQuery.isError ? "error" : "loading";

  return {
    exclusions: exclusionsQuery.data ?? NO_EXCLUSIONS,
    /** 読めたあとは、更新の失敗があっても loaded のまま */
    status,
    retry: () => void exclusionsQuery.refetch(),
    exclude: excludeMutation.mutate,
    excluding: excludeMutation.isPending,
    restore: restoreFromList,
  };
}
