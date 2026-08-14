import type { ScanCandidate, ScanProgressEvent, ScanResult } from "@mimimilli/shared";

/** worker → 親プロセスへ postMessage するメッセージ。 */
export type ScanWorkerOutboundMessage =
  | { type: "progress"; progress: ScanProgressEvent }
  | { type: "completed"; result: ScanResult; candidatePool: ScanCandidate[] }
  | { type: "cancelled" }
  | { type: "error"; message: string; errorKind?: string; stack?: string }
  | { type: "test-gate-ready" };

export type ScanWorkerTerminalMessage = Extract<
  ScanWorkerOutboundMessage,
  { type: "completed" | "cancelled" | "error" }
>;
