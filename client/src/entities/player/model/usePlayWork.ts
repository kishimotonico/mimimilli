import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Work, WorkListItem } from "@mimimilli/shared";
import { prepareWorkPlayback } from "../../work/api";
import { updateCachesAfterPlaybackPrepared } from "../../work/model/workCacheUpdates";
import { apiErrorMessage } from "../../../shared/lib/apiError";
import { useToast } from "../../../shared/ui/useToast";
import { usePlayerRuntimeContext } from "./PlayerRuntimeProvider";
import { usePlayerActions } from "./usePlayerActions";
import { requestWorkPlayback } from "./workPlaybackRequest";

/** 作品の再生開始。準備・鮮度確認・失敗時のトーストは、通常再生も続きから再生も共通。 */
export function usePlayWork() {
  const { controller } = usePlayerRuntimeContext();
  const player = usePlayerActions();
  const queryClient = useQueryClient();
  const toast = useToast();

  const request = useCallback(
    (work: { id: string; status: Work["status"] }, start: (prepared: Work) => void) =>
      requestWorkPlayback(
        {
          guard: controller.playRequests,
          prepare: prepareWorkPlayback,
          updateCaches: (prepared) => updateCachesAfterPlaybackPrepared(queryClient, prepared),
          onError: (err) => toast.error(apiErrorMessage(err, "作品の再生に失敗しました")),
        },
        work,
        start,
      ),
    [controller, queryClient, toast],
  );

  const playWork = useCallback(
    (work: WorkListItem, trackIndex: number) =>
      request(work, (prepared) => {
        const playlist =
          prepared.playlists.find((p) => p.id === prepared.defaultPlaylistId) ??
          prepared.playlists[0];
        const tracks = playlist?.tracks ?? [];
        if (playlist && tracks.length > 0) {
          player.play(work, tracks, Math.min(trackIndex, tracks.length - 1), playlist.id);
        }
      }),
    [request, player],
  );

  const resumeWork = useCallback(
    (work: Work) => request(work, (prepared) => player.playWithResume(prepared)),
    [request, player],
  );

  return useMemo(() => ({ playWork, resumeWork }), [playWork, resumeWork]);
}
