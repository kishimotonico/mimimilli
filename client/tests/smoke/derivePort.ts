// smokeサーバーのポート導出。fixtures.ts本体から分離しているのは、
// forbidden port回避ロジックを純粋関数としてユニットテストから検証できるようにするため。
import { createHash } from "node:crypto";
import { SMOKE_WORKERS } from "./workerCount.ts";

// https://fetch.spec.whatwg.org/#block-bad-port （undiciのbadPortsと同一値）
const FORBIDDEN_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
  512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
  995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668,
  6669, 6679, 6697, 10080,
]);

// cwdの絶対パスから決定的にブロックを選び、そこへworkerIndexを足してworkerごとの
// ポートへ分散する。SMOKE_WORKERS個ぶんを1ブロックとして割り当てるため、
// 異なるworktree同士でもブロック境界がずれない限りworker間のポートが重ならない。
// ブロック内のいずれかのポートがforbidden listに該当する場合はブロックを丸ごと
// 次の候補へずらす（block内のworkerIndexとポートの対応関係を崩さないため）。
export function derivePort(
  cwd: string,
  rangeStart: number,
  rangeSize: number,
  workerIndex: number,
): number {
  const blockCount = Math.floor(rangeSize / SMOKE_WORKERS);
  const initialBlock = createHash("sha256").update(cwd).digest().readUInt32BE(0) % blockCount;
  const block = findUsableBlock(initialBlock, blockCount, rangeStart);
  return rangeStart + block * SMOKE_WORKERS + workerIndex;
}

function findUsableBlock(initialBlock: number, blockCount: number, rangeStart: number): number {
  for (let offset = 0; offset < blockCount; offset++) {
    const block = (initialBlock + offset) % blockCount;
    const ports = Array.from(
      { length: SMOKE_WORKERS },
      (_, workerIndex) => rangeStart + block * SMOKE_WORKERS + workerIndex,
    );
    if (ports.every((port) => !FORBIDDEN_PORTS.has(port))) return block;
  }
  throw new Error("forbidden portを避けたブロックが見つかりませんでした");
}
