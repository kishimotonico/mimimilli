/** スキャン進捗イベントの時間ベース間引き。フェーズの最終イベント（processed === total）は
 *  間引きの対象外として常に emit させる（進捗表示の欠落防止）。 */
export function createProgressThrottle(
  minIntervalMs: number,
  now: () => number = Date.now,
): (processed: number, total: number) => boolean {
  let lastEmitAt = -Infinity;
  return (processed: number, total: number): boolean => {
    if (processed === total) {
      lastEmitAt = now();
      return true;
    }
    const current = now();
    if (current - lastEmitAt < minIntervalMs) return false;
    lastEmitAt = current;
    return true;
  };
}
