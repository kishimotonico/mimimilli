import { expect, test } from "bun:test";
import { createClassificationMethods } from "../../src/adapters/real/classificationMethods.ts";
import type { WorkRepo } from "../../src/adapters/real/workRepo.ts";

test("分類メソッドは real adapter を起動せず直接生成できる", async () => {
  const repo = {
    listTagPrefixes: () => [
      { prefix: "genre:", label: "ジャンル", color: null, showAsAxis: false, protected: false },
    ],
  } as unknown as WorkRepo;

  const methods = createClassificationMethods({ repo });

  expect(await methods.listTagPrefixes()).toEqual([
    { prefix: "genre:", label: "ジャンル", color: null, showAsAxis: false, protected: false },
  ]);
});
