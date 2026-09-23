import type { WorkProjection, WorkSourceMutationResult, WorkspacePath } from "@mimimilli/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Button from "../../../shared/ui/Button";
import { useToast } from "../../../shared/ui/useToast";
import { projectWorkSource } from "../api";
import { invalidateWorkViewQueries } from "../invalidateWorkViewQueries";
import { WORK_QUERY_KEYS } from "../queryKeys";
import {
  canRetryProjection,
  projectionNoticeMessage,
  sourceMutationErrorMessage,
} from "../sourceMutation";

interface SourceProjectionNoticeProps {
  projection: WorkProjection | null | undefined;
  path: WorkspacePath | null;
  onProjected?: (result: WorkSourceMutationResult) => void;
}

export function SourceProjectionNotice({
  projection,
  path,
  onProjected,
}: SourceProjectionNoticeProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: () => projectWorkSource(path!),
    onSuccess: async (result) => {
      queryClient.setQueryData(WORK_QUERY_KEYS.source(result.snapshot.id), result.snapshot);
      await invalidateWorkViewQueries(queryClient, result.snapshot.id);
      onProjected?.(result);
    },
    onError: (error) => {
      toast.error(sourceMutationErrorMessage(error, "一覧への反映に失敗しました"));
    },
  });

  const message = projectionNoticeMessage(projection);
  if (!message) return null;

  return (
    <output className="flex flex-col items-start gap-2">
      <p className="m-0 font-jp text-secondary text-ink-1">{message}</p>
      {path && canRetryProjection(projection) ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          一覧へ反映する
        </Button>
      ) : null}
    </output>
  );
}
