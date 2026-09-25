import type { WorkProjection, WorkSourceMutationResult, WorkspacePath } from "@mimimilli/shared";
import Button from "../../../shared/ui/Button";
import { useToast } from "../../../shared/ui/useToast";
import { useProjectWorkSourceMutation } from "../model/workMutations";
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
  const toast = useToast();
  const mutation = useProjectWorkSourceMutation();
  const project = async (target: WorkspacePath) => {
    let result: WorkSourceMutationResult;
    try {
      result = await mutation.mutateAsync(target);
    } catch (error) {
      toast.error(sourceMutationErrorMessage(error, "一覧への反映に失敗しました"));
      return;
    }
    onProjected?.(result);
  };

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
          onClick={() => void project(path)}
        >
          一覧へ反映する
        </Button>
      ) : null}
    </output>
  );
}
