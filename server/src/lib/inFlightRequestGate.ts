// ロックmiddlewareを通過した（受理済みの）非許可リクエストの同時実行数を数える。
// root再設定はこの数が0になるまで待ってから、既存ジョブの取消・catalog再構築を始める
// （ADR-0029「開始・再試行の手順」手順2・3の間）。
export class InFlightRequestGate {
  private count = 0;
  private waiters: Array<() => void> = [];

  enter(): void {
    this.count += 1;
  }

  leave(): void {
    this.count -= 1;
    if (this.count > 0) return;
    const waiters = this.waiters;
    this.waiters = [];
    for (const resolve of waiters) resolve();
  }

  async drain(): Promise<void> {
    if (this.count <= 0) return;
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }
}
