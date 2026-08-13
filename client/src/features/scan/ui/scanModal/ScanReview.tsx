import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ScanCandidate, ScanResult } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import { ApiRequestError } from "../../../../shared/api/http";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import {
  excludeScanCandidates,
  getScanCandidates,
  registerScanCandidates,
  SCAN_QUERY_KEYS,
} from "../../api";

interface ScanReviewProps {
  result: ScanResult;
  onOpenFiles: (path: string) => void;
}

const EMPTY_CANDIDATES: ScanCandidate[] = [];

function candidatePaths(candidates: ScanCandidate[]): string[] {
  return candidates.map((candidate) => candidate.path);
}

export default function ScanReview({ result, onOpenFiles }: ScanReviewProps) {
  const queryClient = useQueryClient();
  const candidatesQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.candidates(),
    queryFn: getScanCandidates,
    enabled: result.candidates.length > 0,
    initialData: result.candidates,
  });
  const candidates = useMemo(
    () =>
      result.candidates.length > 0 ? (candidatesQuery.data ?? result.candidates) : EMPTY_CANDIDATES,
    [result.candidates, candidatesQuery.data],
  );
  const [selectedPaths, setSelectedPaths] = useState<string[]>(() => candidatePaths(candidates));
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedPaths(candidatePaths(candidates));
  }, [candidates]);

  const refetchAndReset = async () => {
    await queryClient.invalidateQueries({ queryKey: SCAN_QUERY_KEYS.candidates() });
    const refreshed = await queryClient.fetchQuery({
      queryKey: SCAN_QUERY_KEYS.candidates(),
      queryFn: getScanCandidates,
    });
    setSelectedPaths(candidatePaths(refreshed));
  };

  const onMutationError = async (error: unknown) => {
    if (error instanceof ApiRequestError && error.status === 409) {
      setResultMessage("候補が更新されました。選択を更新しました。");
      await refetchAndReset();
      return;
    }
    setResultMessage(apiErrorMessage(error, "候補の操作に失敗しました"));
  };

  const registerMutation = useMutation({
    mutationFn: registerScanCandidates,
    onSuccess: async ({ registered, failures }) => {
      const registeredPaths = new Set<string>(registered.map((entry) => entry.path));
      queryClient.setQueryData<ScanCandidate[]>(SCAN_QUERY_KEYS.candidates(), (previous = []) =>
        previous.filter((candidate) => !registeredPaths.has(candidate.path)),
      );
      setSelectedPaths((previous) => previous.filter((path) => !registeredPaths.has(path)));
      setResultMessage(
        failures.length > 0
          ? `${registered.length}件を登録しました。${failures.length}件は登録できませんでした。`
          : `${registered.length}件を登録しました。`,
      );
    },
    onError: (error) => void onMutationError(error),
  });
  const excludeMutation = useMutation({
    mutationFn: excludeScanCandidates,
    onSuccess: async () => {
      setResultMessage("選択した候補を除外しました。");
      await refetchAndReset();
    },
    onError: (error) => void onMutationError(error),
  });

  const busy = registerMutation.isPending || excludeMutation.isPending;
  const selected = useMemo(
    () => candidates.filter((candidate) => selectedPaths.includes(candidate.path)),
    [candidates, selectedPaths],
  );
  const hasProblems = result.identityConflicts.length > 0 || result.invalidSidecars.length > 0;
  if (candidates.length === 0 && !hasProblems) return null;

  const toggle = (path: string, checked: boolean) => {
    setSelectedPaths((previous) =>
      checked ? [...new Set([...previous, path])] : previous.filter((value) => value !== path),
    );
  };

  return (
    <section
      aria-label="スキャン確認"
      className="flex flex-col gap-3 rounded-[8px] border border-line-soft bg-paper-0 p-3"
    >
      <div>
        <h3 className="font-sans text-[12px] font-semibold text-ink-0">スキャン後の確認</h3>
        <p className="mt-0.5 text-[11px] text-ink-2">
          登録前の候補と、確認が必要なファイルがあります。
        </p>
      </div>
      {candidates.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-sans text-[11px] font-semibold text-ink-1">
            新規登録候補 {candidates.length}件
          </p>
          <div className="flex flex-col divide-y divide-line-soft rounded-[6px] border border-line-soft">
            {candidates.map((candidate) => {
              const checkboxId = `scan-candidate-${candidate.path.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
              return (
                <div key={candidate.path} className="flex gap-2 px-2.5 py-2 text-[11px]">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={selectedPaths.includes(candidate.path)}
                    disabled={busy}
                    onChange={(event) => toggle(candidate.path, event.target.checked)}
                  />
                  <label htmlFor={checkboxId} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block text-ink-0">{candidate.inferredTitle}</span>
                    <span className="mll-selectable block break-all font-mono text-[10px] text-ink-3">
                      {candidate.path}
                    </span>
                    <span className="text-ink-2">音声 {candidate.audioFileCount}件</span>
                  </label>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => registerMutation.mutate(candidatePaths(candidates))}
            >
              すべて登録
            </Button>
            <Button
              disabled={busy || selected.length === 0}
              onClick={() => registerMutation.mutate(selectedPaths)}
            >
              選択したものを登録
            </Button>
            <Button
              variant="quiet"
              disabled={busy || selected.length === 0}
              onClick={() => excludeMutation.mutate(selectedPaths)}
            >
              選択したものを除外
            </Button>
          </div>
        </div>
      )}
      {hasProblems && (
        <div className="flex flex-col gap-2 border-t border-line-soft pt-3">
          <p className="font-sans text-[11px] font-semibold text-ink-1">問題</p>
          {result.identityConflicts.length > 0 && (
            <div>
              <p className="text-[11px] text-ink-1">ID重複 {result.identityConflicts.length}件</p>
              {result.identityConflicts.map((conflict) => (
                <button
                  key={`${conflict.workId}-${conflict.paths.join("/")}`}
                  type="button"
                  className="mll-selectable mt-1 block break-all text-left font-mono text-[10px] text-acc"
                  onClick={() => onOpenFiles(conflict.paths[0]!)}
                >
                  {conflict.paths.join(" / ")}
                </button>
              ))}
            </div>
          )}
          {result.invalidSidecars.length > 0 && (
            <div>
              <p className="text-[11px] text-ink-1">
                不正なsidecar {result.invalidSidecars.length}件
              </p>
              {result.invalidSidecars.map((sidecar) => (
                <button
                  key={sidecar.path}
                  type="button"
                  className="mll-selectable mt-1 block break-all text-left font-mono text-[10px] text-acc"
                  onClick={() => onOpenFiles(sidecar.path)}
                >
                  {sidecar.path} · {sidecar.message}
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] text-ink-3">項目を選ぶとFilesで確認できます。</p>
        </div>
      )}
      {resultMessage && <output className="block text-[11px] text-ink-2">{resultMessage}</output>}
    </section>
  );
}
