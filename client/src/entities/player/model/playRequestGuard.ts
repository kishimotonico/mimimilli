// 作品再生要求の非同期処理中に、後から発行された要求・停止・別の再生開始で古い結果を捨てるための
// トークン管理。
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
