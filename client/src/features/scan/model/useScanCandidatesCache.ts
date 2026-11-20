import { useQuery } from "@tanstack/react-query";
import type { ScanCandidate, ScanCandidatesResponse } from "@mimimilli/shared";
import { scanCandidatesQueryOptions } from "../../../entities/scan/scanCandidatesCache";

const EMPTY_SCAN_CANDIDATES: ScanCandidate[] = [];

export interface ScanCandidatesState {
  /** 読めたあとの応答。読めていないあいだは null */
  response: ScanCandidatesResponse | null;
  candidates: ScanCandidate[];
  /** サーバーの起動後にスキャンが完了している。読めていないあいだは false */
  scanCompleted: boolean;
  /** 一度も読めていないあいだは loading、その取得が失敗したら error。読めたあとは loaded のまま */
  status: "loading" | "error" | "loaded";
}

export function useScanCandidatesState(): ScanCandidatesState {
  // 候補の取得は、打ち切りと待ち合わせのある refreshScanCandidates だけを通す。
  // 自動取得（マウント・invalidate・フォーカス復帰）はその手順を通らず、RJコードの差し替えや登録後の待ち合わせを壊す。
  const query = useQuery({
    ...scanCandidatesQueryOptions,
    enabled: false,
  });

  if (query.data === undefined) {
    return {
      response: null,
      candidates: EMPTY_SCAN_CANDIDATES,
      scanCompleted: false,
      status: query.isError ? "error" : "loading",
    };
  }
  return {
    response: query.data,
    candidates: query.data.candidates,
    scanCompleted: query.data.scanCompleted,
    status: "loaded",
  };
}
