// handlePlay/handleResumeの非同期処理中に、後から発行されたリクエスト・明示的な無効化
// （root再設定突入等）で古い結果を捨てるためのトークン管理。
export interface PlayRequestGuard {
  /** 新しいリクエストを発行し、そのトークンを返す */
  next: () => number;
  /** 進行中の全リクエストを無効化する（このトークンでは isCurrent が常にfalseになる） */
  invalidate: () => void;
  /** そのトークンが依然として最新のリクエストか */
  isCurrent: (token: number) => boolean;
}

export function createPlayRequestGuard(): PlayRequestGuard {
  let current = 0;
  return {
    next: () => ++current,
    invalidate: () => {
      current += 1;
    },
    isCurrent: (token: number) => token === current,
  };
}
