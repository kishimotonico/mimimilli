import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { derivePort } from "../smoke/derivePort.ts";
import { SMOKE_WORKERS } from "../smoke/workerCount.ts";

const RANGE_START = 4700;
const RANGE_SIZE = 500;

// derivePortはブロック(SMOKE_WORKERS個ぶんの連番)をcwdのSHA256から選ぶ。
// 特定のブロックを狙うcwdを探すことで、forbidden port(5060)を含むブロックが
// 実際に発生する入力を用意する。
function findCwdForBlock(targetBlock: number): string {
  const blockCount = Math.floor(RANGE_SIZE / SMOKE_WORKERS);
  for (let i = 0; ; i++) {
    const cwd = `/probe/${i}`;
    const block = createHash("sha256").update(cwd).digest().readUInt32BE(0) % blockCount;
    if (block === targetBlock) return cwd;
  }
}

describe("derivePort", () => {
  it("同じcwdなら常に同じポートを返す", () => {
    const cwd = "/home/nico/projects/mimikago/.worktrees/433";
    const first = derivePort(cwd, RANGE_START, RANGE_SIZE, 0);
    const second = derivePort(cwd, RANGE_START, RANGE_SIZE, 0);
    expect(first).toBe(second);
  });

  it("worker毎に異なるポートを返す", () => {
    const cwd = "/home/nico/projects/mimikago/.worktrees/433";
    const ports = Array.from({ length: SMOKE_WORKERS }, (_, workerIndex) =>
      derivePort(cwd, RANGE_START, RANGE_SIZE, workerIndex),
    );
    expect(new Set(ports).size).toBe(SMOKE_WORKERS);
  });

  it("forbidden portに当たるブロックのcwdでも、避けたポートを返す", () => {
    // (5060 - 4700) / 4 = 90 なのでブロック90にforbidden port(5060, 5061)が含まれる
    const forbiddenBlock = (5060 - RANGE_START) / SMOKE_WORKERS;
    const cwd = findCwdForBlock(forbiddenBlock);

    const ports = Array.from({ length: SMOKE_WORKERS }, (_, workerIndex) =>
      derivePort(cwd, RANGE_START, RANGE_SIZE, workerIndex),
    );
    expect(ports).not.toContain(5060);
    expect(ports).not.toContain(5061);
  });

  it("forbidden portを避けた場合もworker毎の一意性は保たれる", () => {
    const forbiddenBlock = (5060 - RANGE_START) / SMOKE_WORKERS;
    const cwd = findCwdForBlock(forbiddenBlock);

    const ports = Array.from({ length: SMOKE_WORKERS }, (_, workerIndex) =>
      derivePort(cwd, RANGE_START, RANGE_SIZE, workerIndex),
    );
    expect(new Set(ports).size).toBe(SMOKE_WORKERS);
  });
});
