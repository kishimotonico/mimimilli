// スキャン進捗の配信状態（TASK-20）。
//
// 設計: POST /scan は従来どおり完了まで待って ScanResult を返す（互換性を壊さない）。
// GET /scan/events はその実行と並行して同じイベントを SSE で配信するだけの副チャンネル。
// サーバープロセスは単一の常駐アプリを想定するため、モジュール変数でジョブを1つだけ保持する
// （fixture/real 両アダプタで同一の仕組みを使う。複数スキャンの同時実行はそもそも想定しない）。
import type { ScanProgressEvent } from "@mimimilli/shared";

type Listener = (event: ScanProgressEvent) => void;
type ProgressEvent = Extract<ScanProgressEvent, { type: "progress" }>;
type TerminalEvent = Extract<ScanProgressEvent, { type: "complete" | "error" }>;

interface ScanJob {
  listeners: Set<Listener>;
  lastProgress: ProgressEvent | null;
}

let currentJob: ScanJob | null = null;
/** 直近に終了したスキャンの結果。切断→再接続でスキャン完了を見逃さないための最小限のリプレイ用 */
let lastTerminalEvent: TerminalEvent | null = null;

export function isScanInProgress(): boolean {
  return currentJob !== null;
}

/** スキャン開始時に呼ぶ。返り値の emit() を進捗の都度、finish() を完了時に呼ぶこと */
export function startScanJob(): {
  emit: (event: ScanProgressEvent) => void;
  finish: () => void;
} {
  const job: ScanJob = { listeners: new Set(), lastProgress: null };
  currentJob = job;
  lastTerminalEvent = null;

  function emit(event: ScanProgressEvent): void {
    if (event.type === "progress") {
      job.lastProgress = event;
    } else {
      lastTerminalEvent = event;
    }
    for (const listener of job.listeners) listener(event);
  }

  function finish(): void {
    if (currentJob === job) currentJob = null;
  }

  return { emit, finish };
}

/**
 * GET /scan/events から呼ぶ。実行中のジョブがあれば live 購読 + 直近の progress を replay、
 * 無ければ直近の終了イベント（あれば）を replay するだけで isLive=false を返す
 * （呼び出し側は replay を流したら即座にストリームを閉じてよい）。
 */
export function subscribeToScan(listener: Listener): {
  replay: ScanProgressEvent[];
  unsubscribe: () => void;
  isLive: boolean;
} {
  if (currentJob) {
    const job = currentJob;
    job.listeners.add(listener);
    return {
      replay: job.lastProgress ? [job.lastProgress] : [],
      unsubscribe: () => job.listeners.delete(listener),
      isLive: true,
    };
  }
  return {
    replay: lastTerminalEvent ? [lastTerminalEvent] : [],
    unsubscribe: () => {},
    isLive: false,
  };
}

/** テスト用: モジュール状態をリセットする */
export function resetScanProgressStateForTest(): void {
  currentJob = null;
  lastTerminalEvent = null;
}
