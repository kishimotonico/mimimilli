import {
  relativeToRoot,
  type WorkEditSnapshot,
  type WorkProjection,
  type WorkSourceMutationResult,
  type WorkspacePath,
} from "@mimimilli/shared";
import { ApiRequestError, ApiTransportError } from "../../shared/api/http";

export const SOURCE_MUTATION_TRANSPORT_MESSAGE =
  "保存の結果を確認できませんでした。作品情報を読み直してください。";

export function sourceMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiTransportError) return SOURCE_MUTATION_TRANSPORT_MESSAGE;
  if (error instanceof ApiRequestError) return error.message;
  return fallback;
}

export function projectionNoticeMessage(
  projection: WorkProjection | null | undefined,
): string | null {
  if (!projection || projection.status === "published") return null;
  if (projection.reason === "source_changed") {
    return "作品ファイルは保存しました。反映の直前にファイルが変わったため、一覧はまだ古いです。";
  }
  if (projection.reason === "identity_conflict") {
    return "作品ファイルは保存しました。同じ Work ID が別の場所にあるため、一覧へは反映していません。";
  }
  return "作品ファイルは保存しました。一覧への反映に失敗しました。";
}

export function canRetryProjection(projection: WorkProjection | null | undefined): boolean {
  return (
    projection?.status === "pending" &&
    (projection.reason === "source_changed" || projection.reason === "error")
  );
}

export function projectionWorkspacePath(
  snapshot: Pick<WorkEditSnapshot, "physicalPath">,
  root: string,
): WorkspacePath {
  return relativeToRoot(snapshot.physicalPath, root);
}

export function isProjectionPending(
  result: WorkSourceMutationResult | null | undefined,
): result is WorkSourceMutationResult & {
  projection: Extract<WorkProjection, { status: "pending" }>;
} {
  return result?.projection.status === "pending";
}
