import type { ScanProgressEvent } from "@mimimilli/shared";
import type { ScanExecutionResult } from "../../adapter/index.ts";

/** worker → 親プロセスへ postMessage するメッセージ。 */
export type ScanWorkerOutboundMessage =
  | { type: "progress"; progress: ScanProgressEvent }
  | ({ type: "completed" } & ScanExecutionResult)
  | { type: "cancelled" }
  | { type: "error"; message: string; errorKind?: string; stack?: string }
  | { type: "test-gate-ready" };

export type ScanWorkerTerminalMessage = Extract<
  ScanWorkerOutboundMessage,
  { type: "completed" | "cancelled" | "error" }
>;
